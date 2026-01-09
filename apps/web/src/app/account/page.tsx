import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { type AccountSummaryData } from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { AccountSummaryClient } from "@/components/account/account-summary-client";

type Role = "admin" | "contributor" | "viewer";

type AccountWithMembers = {
  id: string;
  name: string;
  base_currency: string;
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value ?? "";
  if (!activeAccountId) {
    redirect("/select-account");
  }

  // Fetch account summary via RPC
  const { data: summaryData, error: rpcError } = await supabase.rpc(
    "get_account_summary",
    { p_account_id: activeAccountId }
  );

  if (rpcError || !summaryData) {
    console.error("[AccountPage] RPC error:", rpcError);
    redirect("/select-account");
  }

  // Fetch all accounts for the switcher
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

  const accountsList: AccountWithMembers[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    base_currency: account.base_currency,
  }));

  // Get user's role from the summary data
  const participant = (summaryData as AccountSummaryData).participants.find(
    (p) => p.user_id === user.id
  );
  const userRole = (participant?.role as Role) ?? "viewer";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <AccountSummaryClient
          summaryData={summaryData as AccountSummaryData}
          currentUserId={user.id}
          role={userRole}
          accounts={accountsList}
          activeAccountId={activeAccountId}
        />
      </PageContainer>
    </div>
  );
}
