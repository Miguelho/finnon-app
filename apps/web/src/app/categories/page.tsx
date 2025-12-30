import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./categories-client";

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
    redirect("/onboarding");
  }

  const activeAccount = accounts[0];
  const activeRole = activeAccount?.account_members?.[0]?.role ?? "viewer";

  if (!activeAccount) {
    redirect("/onboarding");
  }

  // Fetch categories for the active account
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("account_id", activeAccount.id)
    .order("created_at", { ascending: false });

  return (
    <CategoriesClient
      accountId={activeAccount.id}
      initialCategories={categories || []}
      role={activeRole}
    />
  );
}
