import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TransactionsClient } from "./transactions-client";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { AddAction } from "@/components/home/add-action";

export default async function TransactionsPage() {
  const supabase = await createClient();

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
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const createdByIds = Array.from(
    new Set([user.id, ...(transactions ?? []).map((item) => item.created_by)])
  );
  const { data: profiles } =
    createdByIds.length > 0
      ? await supabase
          .from("profiles")
          .select(
            "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token"
          )
          .in("user_id", createdByIds)
      : { data: [] };

  const { data: recurringItems } = await supabase
    .from("recurring_items")
    .select(
      "id, account_id, type, amount_minor, currency, category_id, merchant, notes, start_date, frequency, interval, day_of_month, end_date, is_paused, created_by"
    )
    .eq("account_id", activeAccount.id);

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
      <AddAction
        canEdit={canEdit}
        accountId={activeAccount.id}
        currency={activeAccount.base_currency}
        locale={locale}
        categories={categories || []}
        topCategories={initialTopCategories}
        merchantSuggestions={initialMerchantSuggestions}
      />
      <TransactionsClient
        accountId={activeAccount.id}
        baseCurrency={activeAccount.base_currency}
        initialTransactions={transactions || []}
        initialRecurringItems={recurringItems || []}
        categories={categories || []}
        profiles={profiles || []}
        role={activeRole}
        initialTopCategories={initialTopCategories}
        initialMerchantSuggestions={initialMerchantSuggestions}
      />
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
