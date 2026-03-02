import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { CreateCategoryClient } from "./create-category-client";

export default async function CreateCategoryPage() {
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
  const activeRole = activeAccount?.account_members?.[0]?.role ?? "viewer";
  const canEdit = activeRole !== "viewer";

  if (!activeAccount) {
    redirect("/select-account");
  }

  if (!canEdit) {
    redirect("/transactions");
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <CreateCategoryClient accountId={activeAccount.id} />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
