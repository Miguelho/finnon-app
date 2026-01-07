import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./categories-client";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";

export default async function CategoriesPage() {
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
    .select("id, name, account_members!inner(role)")
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

  if (!activeAccount) {
    redirect("/select-account");
  }

  // Fetch categories for the active account
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("account_id", activeAccount.id)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-background">
      <TopNav containerClassName="max-w-6xl" />
      <CategoriesClient
        accountId={activeAccount.id}
        initialCategories={categories || []}
        role={activeRole}
      />
    </div>
  );
}
