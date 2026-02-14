import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { RecurrentesClient } from "./recurrent-client";

export default async function RecurrentesPage() {
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

  // Fetch recurring items for the active account
  const { data: recurringItems } = await supabase
    .from("recurring_items")
    .select(
      `
      *,
      category:categories(id, name, icon_id, type)
    `
    )
    .eq("account_id", activeAccount.id)
    .order("merchant", { ascending: true });

  // Fetch categories for edit form
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon_id, type")
    .eq("account_id", activeAccount.id)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <RecurrentesClient
        accountId={activeAccount.id}
        baseCurrency={activeAccount.base_currency}
        initialRecurringItems={recurringItems || []}
        categories={categories || []}
        canEdit={canEdit}
      />
    </div>
  );
}
