import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans } from "next/font/google";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { HomePageClient } from "@/components/home-redesign/HomePageClient";
import {
  CATEGORY_PALETTE,
  CURRENCIES,
  getExpandedMonthRange,
} from "@poleursus/shared";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

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

    const rows = (data ?? []) as Array<HomeTransactionRow & { category?: unknown }>;
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
    .in("status", ["active", "completed"])
    .order("priority", { ascending: true });
  if (projectsError) {
    console.error("[HomePage][web] projects query error:", projectsError);
  }

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: projectContributions, error: projectContributionsError } =
    projectIds.length > 0
      ? await supabase
          .from("project_contributions")
          .select("*")
          .in("project_id", projectIds)
      : { data: [], error: null };
  if (projectContributionsError) {
    console.error(
      "[HomePage][web] project contributions query error:",
      projectContributionsError
    );
  }

  const creatorUserIds = Array.from(
    new Set(
      [...normalizedMonthlyTransactions, ...normalizedUpcomingTransactions]
        .map((transaction) => transaction.created_by)
        .filter((value): value is string => Boolean(value))
    )
  );
  const { data: profiles } =
    creatorUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select(
            "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
          )
          .in("user_id", creatorUserIds)
      : { data: [] };

  const accountsWithBalance = await Promise.all(
    accounts.map(async (account, index) => {
      try {
        const { data, error } = await supabase.rpc("get_account_summary", {
          p_account_id: account.id,
        });
        if (error) throw error;
        const balanceMinor = toMinor((data as any)?.totals?.balance_total ?? 0);
        return {
          id: account.id,
          name: account.name,
          balanceMinor: balanceMinor.toString(),
          color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]!,
        };
      } catch (error) {
        console.warn("[HomePage][web] account balance fallback to 0:", account.id, error);
        return {
          id: account.id,
          name: account.name,
          balanceMinor: "0",
          color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]!,
        };
      }
    })
  );

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;

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
        accounts={accountsWithBalance}
        monthlyTransactions={normalizedMonthlyTransactions}
        upcomingTransactions={normalizedUpcomingTransactions}
        obligations={obligations ?? []}
        profiles={profiles ?? []}
        projects={projects ?? []}
        projectContributions={projectContributions ?? []}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
