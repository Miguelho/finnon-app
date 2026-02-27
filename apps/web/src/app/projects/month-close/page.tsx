import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  addMonths,
  computePendingMonthCloseKeys,
  CURRENCIES,
  getMonthRangeFromKey,
  toMonthKey,
  type Project,
  type UserRole,
} from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { MonthCloseClient } from "./month-close-client";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const toMinor = (value: bigint | number | string | null | undefined) => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

type SearchParams = {
  month?: string;
};

type AccountRow = {
  id: string;
  name: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole }>;
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

  const { data: projectRows } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", activeAccount.id)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  const allActiveProjects = (projectRows ?? []) as Project[];
  const huchaProject = allActiveProjects.find((project) => project.is_hucha) ?? null;
  const projects = allActiveProjects.filter((project) => {
    return !project.is_hucha && toMinor(project.monthly_commitment_base_minor) > 0n;
  });

  const currentMonthKey = toMonthKey(new Date());
  const defaultMonthKey = addMonths(currentMonthKey, -1);
  const { data: confirmedContributionRows } =
    projects.length > 0
      ? await supabase
          .from("project_contributions")
          .select("project_id, period")
          .eq("account_id", activeAccount.id)
          .eq("confirmed", true)
          .in("project_id", projects.map((project) => project.id))
      : { data: [] };

  const pendingMonthKeys = computePendingMonthCloseKeys({
    commitmentProjects: projects.map((project) => ({
      projectId: project.id,
      createdAt: project.created_at ?? null,
    })),
    confirmedContributions: (confirmedContributionRows ?? []).map((row) => ({
      projectId: row.project_id,
      period: row.period,
    })),
    currentMonthKey,
  });

  const requestedMonth = resolvedSearchParams.month;
  const monthKey =
    typeof requestedMonth === "string" && MONTH_KEY_PATTERN.test(requestedMonth)
      ? requestedMonth
      : pendingMonthKeys[0] ?? defaultMonthKey;
  const monthRange = getMonthRangeFromKey(monthKey);

  const { data: monthTransactions } = await supabase
    .from("transactions")
    .select("type, amount_minor, amount_base_minor")
    .eq("account_id", activeAccount.id)
    .gte("date", monthRange.start)
    .lte("date", monthRange.end);

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  (monthTransactions ?? []).forEach((transaction) => {
    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor ?? 0
    );
    if (transaction.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }
  });

  const actualSavedMinor = incomeMinor - expenseMinor;

  const projectIds = [
    ...projects.map((project) => project.id),
    ...(huchaProject ? [huchaProject.id] : []),
  ];
  const { data: contributions } =
    projectIds.length > 0
      ? await supabase
          .from("project_contributions")
          .select("*")
          .eq("account_id", activeAccount.id)
          .eq("period", monthRange.start)
          .in("project_id", projectIds)
      : { data: [] };

  const userIds = Array.from(
    new Set((contributions ?? []).map((item) => item.user_id).filter(Boolean))
  );
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds)
      : { data: [] };

  const userLabels = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
    acc[profile.user_id] =
      profile.display_name?.trim() || profile.email?.trim() || profile.user_id.slice(0, 8);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MonthCloseClient
        accountId={activeAccount.id}
        role={role}
        currentUserId={user.id}
        monthKey={monthKey}
        pendingMonthKeys={pendingMonthKeys}
        monthStart={monthRange.start}
        baseCurrency={activeAccount.base_currency}
        currencySymbol={currencySymbol}
        actualSavedMinor={actualSavedMinor.toString()}
        projects={projects}
        huchaProject={huchaProject}
        existingContributions={contributions ?? []}
        userLabels={userLabels}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
