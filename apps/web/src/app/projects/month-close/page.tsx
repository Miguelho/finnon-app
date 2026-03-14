import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  addMonths,
  clampMonthKeyToLatestClosable,
  computePendingMonthCloseKeysFromMonthCloses,
  CURRENCIES,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type UserRole,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { MonthCloseClient } from "./month-close-client";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

type SearchParams = {
  month?: string;
};

type AccountRow = {
  id: string;
  name: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole }>;
};

type SavingsMonthStateRow = {
  period: string;
  generated_saved_base_minor: string | number;
  planned_to_projects_base_minor: string | number;
  available_to_plan_minor: string | number;
  needs_rebalance: boolean;
  is_closed: boolean;
  closed_at: string | null;
  allocated_to_projects_base_minor: string | number | null;
  allocated_to_reserves_base_minor: string | number | null;
  plans: Array<{
    project_id: string;
    planned_amount_base_minor: string | number;
  }>;
};

export default async function ProjectsMonthClosePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
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
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const activeAccount = (accounts as AccountRow[]).find(
    (account) => account.id === cookieAccountId
  );

  if (!activeAccount) {
    redirect("/select-account");
  }

  const role = activeAccount.account_members?.[0]?.role ?? "viewer";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === activeAccount.base_currency)
      ?.symbol ?? activeAccount.base_currency;

  const [projectsResult, reserveContainersResult, monthClosesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("account_id", activeAccount.id)
      .not("target_amount_base_minor", "is", null)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("reserve_containers")
      .select("*")
      .eq("account_id", activeAccount.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("month_closes")
      .select("*")
      .eq("account_id", activeAccount.id)
      .order("period", { ascending: false }),
  ]);

  if (projectsResult.error) throw projectsResult.error;
  if (reserveContainersResult.error) throw reserveContainersResult.error;
  if (monthClosesResult.error) throw monthClosesResult.error;

  const projects = (projectsResult.data ?? []) as Project[];
  const reserveContainers = (reserveContainersResult.data ?? []) as ReserveContainer[];
  const monthCloses = (monthClosesResult.data ?? []) as MonthClose[];

  const currentMonthKey = toMonthKey(new Date());
  const defaultMonthKey = addMonths(currentMonthKey, -1);
  const pendingMonthKeys = computePendingMonthCloseKeysFromMonthCloses({
    commitmentProjects: projects.map((project) => ({
      projectId: project.id,
      createdAt: project.created_at ?? null,
    })),
    closedMonths: monthCloses.map((monthClose) => ({ period: monthClose.period })),
    currentMonthKey,
  });

  const requestedMonth = resolvedSearchParams.month;
  const sanitizedRequestedMonth =
    typeof requestedMonth === "string" && MONTH_KEY_PATTERN.test(requestedMonth)
      ? clampMonthKeyToLatestClosable(requestedMonth, currentMonthKey)
      : null;
  if (typeof requestedMonth === "string" && sanitizedRequestedMonth !== requestedMonth) {
    redirect(`/projects/month-close?month=${sanitizedRequestedMonth}`);
  }
  const monthKey = sanitizedRequestedMonth ?? pendingMonthKeys[0] ?? defaultMonthKey;
  const monthStart = `${monthKey}-01`;

  const { data: monthState, error: monthStateError } = await supabase.rpc(
    "get_savings_month_state",
    {
      p_account_id: activeAccount.id,
      p_period: monthStart,
    }
  );

  if (monthStateError) throw monthStateError;

  const selectedMonthClose =
    monthCloses.find((monthClose) => String(monthClose.period).slice(0, 7) === monthKey) ?? null;

  const { data: monthCloseAllocations, error: monthCloseAllocationsError } =
    selectedMonthClose?.id
      ? await supabase
          .from("month_close_allocations")
          .select("*")
          .eq("month_close_id", selectedMonthClose.id)
          .order("created_at", { ascending: true })
      : { data: [] as MonthCloseAllocation[], error: null };

  if (monthCloseAllocationsError) throw monthCloseAllocationsError;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MonthCloseClient
        accountId={activeAccount.id}
        role={role}
        locale={locale}
        monthKey={monthKey}
        pendingMonthKeys={pendingMonthKeys}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        projects={projects}
        reserveContainers={reserveContainers}
        monthState={(monthState ?? null) as SavingsMonthStateRow | null}
        monthClose={selectedMonthClose}
        monthCloseAllocations={(monthCloseAllocations ?? []) as MonthCloseAllocation[]}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
