import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans } from "next/font/google";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { HomePageClient } from "@/components/home-redesign/HomePageClient";
import {
  buildHomeProjectPreviews,
  CURRENCIES,
  computeSavingsMonthFromTransactions,
  computeSavingsMonthView,
  formatMonthLabel,
  getExpandedMonthRange,
  toMonthKey,
} from "@poleursus/shared";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
  ...row,
  category: Array.isArray(row.category)
    ? (row.category[0] ?? null)
    : (row.category ?? null),
});

const toMinor = (value: string | number | bigint | null | undefined): bigint => {
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

type HomeTransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  project_id?: string | null;
  date: string;
  merchant: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  category?: {
    id: string;
    name: string;
    icon_id: string | null;
    color?: string | null;
  } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role, user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const cookieAccountId = cookieStore.get("finnon:activeAccountId")?.value;
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";

  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const mainAccount = accounts.find((account) => account.id === cookieAccountId);

  if (!mainAccount) {
    redirect("/select-account");
  }

  const activeRole =
    mainAccount.account_members?.find((member) => member.user_id === user.id)?.role ??
    "viewer";
  const canEdit = activeRole !== "viewer";

  const today = new Date();
  const expandedRange = getExpandedMonthRange(today);
  const startDate = expandedRange.start.toISOString().slice(0, 10);
  const endDate = expandedRange.end.toISOString().slice(0, 10);
  const maxUpcomingDays = 30;
  const upcomingEnd = new Date(today);
  upcomingEnd.setDate(upcomingEnd.getDate() + maxUpcomingDays);
  const obligationsEnd =
    upcomingEnd > expandedRange.end ? upcomingEnd : expandedRange.end;
  const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
  const upcomingStartDate = today.toISOString().slice(0, 10);
  const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);

  const loadTransactions = async ({
    start,
    end,
    ascending,
  }: {
    start: string;
    end: string;
    ascending: boolean;
  }): Promise<HomeTransactionRow[]> => {
    const runQuery = (selectClause: string) => {
      let query = supabase
        .from("transactions")
        .select(selectClause)
        .eq("account_id", mainAccount.id)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending });

      if (!ascending) {
        query = query.order("created_at", { ascending: false });
      }

      return query;
    };

    let { data, error } = await runQuery(TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR);

    if (isMissingCategoryColorError(error)) {
      console.warn(
        "[HomePage][web] categories.color missing, retrying transactions query without color."
      );
      ({ data, error } = await runQuery(TRANSACTIONS_SELECT_LEGACY));
    }

    if (error) {
      console.error("[HomePage][web] transactions query error:", error);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      HomeTransactionRow & { category?: unknown }
    >;
    return rows.map(normalizeCategory) as HomeTransactionRow[];
  };

  const [normalizedMonthlyTransactions, normalizedUpcomingTransactions] = await Promise.all([
    loadTransactions({ start: startDate, end: endDate, ascending: false }),
    loadTransactions({ start: upcomingStartDate, end: upcomingEndDate, ascending: true }),
  ]);

  const { data: obligationsRange, error: obligationsRangeError } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .gte("due_date", startDate)
    .lte("due_date", obligationsEndDate)
    .order("due_date", { ascending: true });
  if (obligationsRangeError) {
    console.error("[HomePage][web] obligations range query error:", obligationsRangeError);
  }

  const { data: obligationsNoDate, error: obligationsNoDateError } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .is("due_date", null);
  if (obligationsNoDateError) {
    console.error("[HomePage][web] obligations no-date query error:", obligationsNoDateError);
  }

  const obligations = [...(obligationsRange ?? []), ...(obligationsNoDate ?? [])];

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", mainAccount.id)
    .not("target_amount_base_minor", "is", null)
    .in("status", ["active", "completed"])
    .order("priority", { ascending: true });
  if (projectsError) {
    console.error("[HomePage][web] projects query error:", projectsError);
  }

  const currentPeriodStart = `${toMonthKey(today)}-01`;
  const [{ data: fundingPlans, error: fundingPlansError }, { data: currentMonthClose, error: currentMonthCloseError }] =
    await Promise.all([
      supabase
        .from("monthly_project_funding_plans")
        .select("*")
        .eq("account_id", mainAccount.id)
        .eq("period", currentPeriodStart),
      supabase
        .from("month_closes")
        .select("*")
        .eq("account_id", mainAccount.id)
        .eq("period", currentPeriodStart)
        .maybeSingle(),
    ]);

  if (fundingPlansError) {
    console.error("[HomePage][web] funding plans query error:", fundingPlansError);
  }
  if (currentMonthCloseError) {
    console.error("[HomePage][web] current month close query error:", currentMonthCloseError);
  }

  let balanceMinor = 0n;
  try {
    const { data, error } = await supabase.rpc("get_account_summary", {
      p_account_id: mainAccount.id,
    });
    if (error) throw error;
    balanceMinor = toMinor((data as any)?.totals?.balance_total ?? 0);
  } catch (error) {
    console.warn("[HomePage][web] account balance fallback to 0:", mainAccount.id, error);
  }

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: contributionRows, error: contributionRowsError } =
    projectIds.length > 0
      ? await supabase
          .from("transactions")
          .select("project_id, amount_base_minor")
          .eq("account_id", mainAccount.id)
          .eq("type", "expense")
          .in("project_id", projectIds)
      : {
          data: [],
          error: null,
        };

  if (contributionRowsError) {
    console.error("[HomePage][web] contribution transactions query error:", contributionRowsError);
  }

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;

  const monthTransactionsToDate = normalizedMonthlyTransactions.filter((transaction) => {
    const transactionDate = transaction.date.slice(0, 7);
    return transactionDate === currentPeriodStart.slice(0, 7) && transaction.date <= today.toISOString().slice(0, 10);
  });
  const monthTotals = computeSavingsMonthFromTransactions(monthTransactionsToDate);
  const savingsState = computeSavingsMonthView({
    period: currentPeriodStart.slice(0, 7),
    transactions: monthTransactionsToDate,
    fundingPlans: fundingPlans ?? [],
    monthClose: currentMonthClose,
  });
  const homeMonthlySavingsMinor =
    savingsState.generatedSavedMinor > 0n ? savingsState.generatedSavedMinor : 0n;
  const monthLabel = formatMonthLabel(currentPeriodStart.slice(0, 7), locale === "en" ? "en-US" : "es-ES");
  const currentMonth = monthLabel ? `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}` : "";

  return (
    <div className={cn("min-h-screen bg-background", dmSans.className)}>
      <TopNav />
      <HomePageClient
        account={{
          id: mainAccount.id,
          canEdit,
          currencySymbol,
          baseCurrency: mainAccount.base_currency,
          locale,
        }}
        monthlyTransactions={normalizedMonthlyTransactions}
        upcomingTransactions={normalizedUpcomingTransactions}
        obligations={obligations ?? []}
        summary={{
          balanceMinor: balanceMinor.toString(),
          monthlySavingsMinor: homeMonthlySavingsMinor.toString(),
          monthlyIncomeMinor: monthTotals.incomeMinor.toString(),
          monthlyExpensesMinor: monthTotals.expenseMinor.toString(),
          availableMinor: savingsState.availableToPlanMinor.toString(),
          currentMonth,
          topProjects: buildHomeProjectPreviews({
            projects: projects ?? [],
            contributionRows: (contributionRows ?? []) as Array<{
              project_id: string | null;
              amount_base_minor: string | number | bigint | null;
            }>,
            limit: 3,
            now: today,
          }).map((project) => ({
            ...project,
            goalAmount: project.goalAmount.toString(),
            totalContributed: project.totalContributed.toString(),
            estimatedCompletion: project.estimatedCompletion?.toISOString() ?? null,
          })),
        }}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
