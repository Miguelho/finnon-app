import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TransactionsClient } from "./transactions-client";
import { cookies } from "next/headers";

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
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const activeAccount =
    accounts.find((account) => account.id === cookieAccountId) ?? accounts[0];
  const activeRole = activeAccount?.account_members?.[0]?.role ?? "viewer";

  if (!activeAccount) {
    redirect("/onboarding");
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

  // Fetch categories for the active account (for the form dropdown)
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("account_id", activeAccount.id)
    .order("name", { ascending: true });

  return (
    <TransactionsClient
      accountId={activeAccount.id}
      baseCurrency={activeAccount.base_currency}
      initialTransactions={transactions || []}
      categories={categories || []}
      role={activeRole}
    />
  );
}
