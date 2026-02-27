import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  addMonths,
  computePendingMonthCloseKeys,
  CURRENCIES,
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
  const projectsWithCommitment = (projects ?? []).filter((project) => {
    const raw = project.monthly_commitment_base_minor;
    if (project.is_hucha) return false;
    if (raw === null || raw === undefined) return false;
    try {
      return BigInt(raw) > 0n;
    } catch {
      return false;
    }
  });

  const pendingMonthKeys = computePendingMonthCloseKeys({
    commitmentProjects: projectsWithCommitment.map((project) => ({
      projectId: project.id,
      createdAt: project.created_at ?? null,
    })),
    confirmedContributions: ((contributions ?? []) as Array<{
      project_id: string;
      confirmed?: boolean;
      period: string | Date;
    }>)
      .filter((row) => Boolean(row.confirmed))
      .map((row) => ({
        projectId: row.project_id,
        period: row.period,
      })),
    currentMonthKey,
  });

  const hasPendingMonthlyClose = pendingMonthKeys.length > 0;
  const pendingMonthKey =
    pendingMonthKeys[0] ?? addMonths(currentMonthKey, -1);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
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
