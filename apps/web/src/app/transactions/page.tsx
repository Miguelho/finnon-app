import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MovementsClient } from "./movements-client";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import {
  toMonthKey,
  getMonthRangeFromKey,
  PERIODS,
  type Period,
} from "@poleursus/shared";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const activeAccount = accounts.find(
    (account) => account.id === cookieAccountId
  );
  const activeRole = activeAccount?.account_members?.[0]?.role ?? "viewer";
  const canEdit = activeRole !== "viewer";

  if (!activeAccount) {
    redirect("/select-account");
  }

  const periodParamRaw = resolvedSearchParams.period;
  const periodParam =
    typeof periodParamRaw === "string" &&
    PERIODS.some((p) => p.key === periodParamRaw)
      ? (periodParamRaw as Period)
      : "month";
  const monthParamRaw = resolvedSearchParams.month;
  const monthParam =
    typeof monthParamRaw === "string" && /^\d{4}-\d{2}$/.test(monthParamRaw)
      ? monthParamRaw
      : toMonthKey(new Date());
  const categoryParamRaw = resolvedSearchParams.category;
  const categoryParam =
    typeof categoryParamRaw === "string"
      ? categoryParamRaw
      : Array.isArray(categoryParamRaw)
        ? categoryParamRaw[0]
        : undefined;
  const typeParamRaw = resolvedSearchParams.type;
  const typeParam =
    typeof typeParamRaw === "string"
      ? typeParamRaw
      : Array.isArray(typeParamRaw)
        ? typeParamRaw[0]
        : undefined;
  const monthRange = getMonthRangeFromKey(monthParam);

  // Fetch transactions for the active account (ordered by date DESC)
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      *,
      category:categories(id, name, icon_id, type)
    `
    )
    .eq("account_id", activeAccount.id)
    .gte("date", monthRange.start)
    .lte("date", monthRange.end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const createdByIds = Array.from(
    new Set([user.id, ...(transactions ?? []).map((item) => item.created_by)])
  );

  const { data: accountMembers } = await supabase
    .from("account_members")
    .select("user_id, role")
    .eq("account_id", activeAccount.id);

  const memberUserIds = (accountMembers ?? []).map((member) => member.user_id);
  const { data: profiles } =
    [...createdByIds, ...memberUserIds].length > 0
      ? await supabase
          .from("profiles")
          .select(
            "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
          )
          .in("user_id", Array.from(new Set([...createdByIds, ...memberUserIds])))
      : { data: [] };

  const profileByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile])
  );
  const formParticipants: FormParticipant[] = (accountMembers ?? []).map((member) => {
    const profile = profileByUserId.get(member.user_id);
    const name =
      profile?.display_name?.trim() ||
      profile?.email?.trim() ||
      member.user_id.slice(0, 6);

    return {
      userId: member.user_id,
      role: member.role as FormParticipant["role"],
      name,
    };
  });

  const { data: recurringItems } = await supabase
    .from("recurring_items")
    .select(
      "id, account_id, type, amount_minor, currency, category_id, merchant, notes, start_date, frequency, interval, day_of_month, end_date, is_paused, created_by"
    )
    .eq("account_id", activeAccount.id)
    .lte("start_date", monthRange.end)
    .or(`end_date.is.null,end_date.gte.${monthRange.start}`);

  // Fetch categories for the active account (for the form dropdown)
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("account_id", activeAccount.id)
    .order("name", { ascending: true });

  // Fetch top categories and merchant suggestions for both expense and income types
  const [
    topExpenseResult,
    topIncomeResult,
    merchantExpenseResult,
    merchantIncomeResult,
  ] = await Promise.all([
    supabase.rpc("get_top_categories", {
      p_account_id: activeAccount.id,
      p_tx_type: "expense",
      p_limit: 3,
    }),
    supabase.rpc("get_top_categories", {
      p_account_id: activeAccount.id,
      p_tx_type: "income",
      p_limit: 3,
    }),
    supabase.rpc("get_merchant_suggestions", {
      p_account_id: activeAccount.id,
      p_tx_type: "expense",
      p_limit: 20,
    }),
    supabase.rpc("get_merchant_suggestions", {
      p_account_id: activeAccount.id,
      p_tx_type: "income",
      p_limit: 20,
    }),
  ]);

  const initialTopCategories = {
    expense: topExpenseResult.data || [],
    income: topIncomeResult.data || [],
  };

  const initialMerchantSuggestions = {
    expense: merchantExpenseResult.data || [],
    income: merchantIncomeResult.data || [],
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MovementsClient
        accountId={activeAccount.id}
        baseCurrency={activeAccount.base_currency}
        initialTransactions={transactions || []}
        initialRecurringItems={recurringItems || []}
        initialPeriod={periodParam}
        initialMonth={monthParam}
        initialCategoryFilter={categoryParam ?? null}
        initialTypeFilter={typeParam ?? null}
        categories={categories || []}
        initialTopCategories={initialTopCategories}
        initialMerchantSuggestions={initialMerchantSuggestions}
        profiles={profiles || []}
        participants={formParticipants}
        currentUserId={user.id}
        role={activeRole}
      />
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
