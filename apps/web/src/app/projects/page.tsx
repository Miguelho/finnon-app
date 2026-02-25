import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  addMonths,
  CURRENCIES,
  getMonthRangeFromKey,
  toMonthKey,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
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

  const activeAccount = accounts.find((account) => account.id === cookieAccountId);
  if (!activeAccount) {
    redirect("/select-account");
  }

  const role = activeAccount.account_members?.[0]?.role ?? "viewer";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)
      ?.symbol ?? activeAccount.base_currency;

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", activeAccount.id)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: contributions } =
    projectIds.length > 0
      ? await supabase
          .from("project_contributions")
          .select("*")
          .in("project_id", projectIds)
      : { data: [] };

  const currentMonthKey = toMonthKey(new Date());
  const pendingMonthKey = addMonths(currentMonthKey, -1);
  const pendingRange = getMonthRangeFromKey(pendingMonthKey);
  const projectsWithCommitment = (projects ?? []).filter((project) => {
    const raw = project.monthly_commitment_base_minor;
    if (raw === null || raw === undefined) return false;
    try {
      return BigInt(raw) > 0n;
    } catch {
      return false;
    }
  });

  const commitmentProjectIds = projectsWithCommitment.map((project) => project.id);
  const { data: pendingMonthConfirmed } =
    commitmentProjectIds.length > 0
      ? await supabase
          .from("project_contributions")
          .select("project_id")
          .eq("account_id", activeAccount.id)
          .eq("period", pendingRange.start)
          .eq("confirmed", true)
          .in("project_id", commitmentProjectIds)
      : { data: [] };

  const confirmedProjectIds = new Set(
    (pendingMonthConfirmed ?? []).map((item) => item.project_id)
  );
  const hasPendingMonthlyClose =
    commitmentProjectIds.length > 0 &&
    commitmentProjectIds.some((projectId) => !confirmedProjectIds.has(projectId));

  return (
    <div className="min-h-screen bg-background">
      <TopNav containerClassName="max-w-6xl" />
      <ProjectsClient
        accountId={activeAccount.id}
        currentUserId={user.id}
        role={role}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        initialProjects={projects ?? []}
        initialContributions={contributions ?? []}
        hasPendingMonthlyClose={hasPendingMonthlyClose}
        pendingMonthKey={pendingMonthKey}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
