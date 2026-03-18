import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { CreateTransactionClient } from "./create-transaction-client";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

export default async function CreateTransactionPage({
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

  if (!canEdit) {
    redirect("/transactions");
  }

  // Resolve kind param (movement or recurring)
  const kindParamRaw = resolvedSearchParams.kind;
  const kind =
    typeof kindParamRaw === "string" && kindParamRaw === "recurring"
      ? "recurring"
      : "movement";

  const dateParamRaw = resolvedSearchParams.date;
  const defaultDate =
    typeof dateParamRaw === "string" ? dateParamRaw : undefined;

  // Fetch account members and profiles
  const { data: accountMembers } = await supabase
    .from("account_members")
    .select("user_id, role")
    .eq("account_id", activeAccount.id);

  const memberUserIds = (accountMembers ?? []).map((member) => member.user_id);
  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, email, display_name")
          .in("user_id", memberUserIds)
      : { data: [] };

  const profileByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile])
  );
  const formParticipants: FormParticipant[] = (accountMembers ?? []).map(
    (member) => {
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
    }
  );

  // Fetch categories for the active account
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon_id, type")
    .eq("account_id", activeAccount.id)
    .order("name", { ascending: true });

  // Fetch top categories and merchant suggestions for both types
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
      <CreateTransactionClient
        kind={kind}
        accountId={activeAccount.id}
        currency={activeAccount.base_currency}
        locale={locale}
        categories={categories || []}
        topCategories={initialTopCategories}
        merchantSuggestions={initialMerchantSuggestions}
        participants={formParticipants}
        currentUserId={user.id}
        defaultDate={defaultDate}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
