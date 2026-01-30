import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { GoalClient } from "./goal-client";
import {
  addMonths,
  CURRENCIES,
  getMonthRangeFromKey,
  toMonthKey,
} from "@poleursus/shared";

export default async function GoalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const activeAccount = accounts.find(
    (account) => account.id === cookieAccountId
  );

  if (!activeAccount) {
    redirect("/select-account");
  }

  const activeRole = activeAccount?.account_members?.[0]?.role ?? "viewer";
  const monthKey = toMonthKey(new Date());
  const { start, end } = getMonthRangeFromKey(monthKey);
  const previousMonthKey = addMonths(monthKey, -1);
  const previousMonthRange = getMonthRangeFromKey(previousMonthKey);

  const { data: goal } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("account_id", activeAccount.id)
    .eq("month", monthKey)
    .eq("type", "save")
    .maybeSingle();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount_minor, amount_base_minor, category:categories(id, name, icon_id)")
    .eq("account_id", activeAccount.id)
    .gte("date", start)
    .lte("date", end);

  const { data: previousExpenses } = await supabase
    .from("transactions")
    .select("amount_minor, amount_base_minor")
    .eq("account_id", activeAccount.id)
    .eq("type", "expense")
    .gte("date", previousMonthRange.start)
    .lte("date", previousMonthRange.end);

  const previousExpenseTotalMinor = (previousExpenses ?? []).reduce(
    (total, item) => {
      const raw = item.amount_base_minor ?? item.amount_minor ?? "0";
      try {
        return total + BigInt(raw);
      } catch {
        return total;
      }
    },
    0n
  );

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)
      ?.symbol ?? activeAccount.base_currency;

  return (
    <div className="min-h-screen bg-background">
      <TopNav containerClassName="max-w-6xl" />
      <GoalClient
        accountId={activeAccount.id}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        monthKey={monthKey}
        role={activeRole}
        currentUserId={user.id}
        initialGoal={goal}
        initialTransactions={transactions ?? []}
        initialPreviousExpenseTotalMinor={previousExpenseTotalMinor.toString()}
      />
      {/* Bottom padding for mobile nav */}
      <div className="h-16 md:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
