import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  computePendingMonthCloseKeysFromMonthCloses,
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
    .not("target_amount_base_minor", "is", null)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  const projectIds = (projects ?? []).map((project) => project.id);
  const [
    reserveContainersResult,
    fundingPlansResult,
    monthClosesResult,
    monthCloseAllocationsResult,
    reserveTransfersResult,
  ] = await Promise.all([
    supabase
      .from("reserve_containers")
      .select("*")
      .eq("account_id", activeAccount.id)
      .eq("status", "active"),
    supabase
      .from("monthly_project_funding_plans")
      .select("*")
      .eq("account_id", activeAccount.id)
      .eq("period", `${toMonthKey(new Date())}-01`),
    supabase
      .from("month_closes")
      .select("*")
      .eq("account_id", activeAccount.id),
    supabase
      .from("month_close_allocations")
      .select("*")
      .eq("account_id", activeAccount.id),
    supabase
      .from("reserve_transfers")
      .select("*")
      .eq("account_id", activeAccount.id),
  ]);

  const { data: extraContributions } =
    projectIds.length > 0
      ? await supabase
          .from("transactions")
          .select("project_id, amount_base_minor")
          .eq("account_id", activeAccount.id)
          .eq("type", "expense")
          .in("project_id", projectIds)
      : { data: [] };

  const currentMonthKey = toMonthKey(new Date());
  const pendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
    commitmentProjects: (projects ?? []).map((project) => ({
      projectId: project.id,
      createdAt: project.created_at ?? null,
    })),
    closedMonths: ((monthClosesResult.data ?? []) as Array<{ period: string | Date }>).map((row) => ({
      period: row.period,
    })),
    currentMonthKey,
  });

  const hasPendingMonthlyClose = pendingMonthKeys.length > 0;
  const pendingMonthKey = pendingMonthKeys[0] ?? null;

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
        reserveContainers={reserveContainersResult.data ?? []}
        fundingPlans={fundingPlansResult.data ?? []}
        monthCloses={monthClosesResult.data ?? []}
        monthCloseAllocations={monthCloseAllocationsResult.data ?? []}
        reserveTransfers={reserveTransfersResult.data ?? []}
        initialExtraContributions={
          (extraContributions ?? []) as Array<{
            project_id: string | null;
            amount_base_minor: string | number | bigint | null;
          }>
        }
        hasPendingMonthlyClose={hasPendingMonthlyClose}
        pendingMonthKey={pendingMonthKey ?? ""}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
