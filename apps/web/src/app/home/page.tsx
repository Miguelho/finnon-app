import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { HomePageClient } from "@/components/home-redesign/HomePageClient";
import {
  CURRENCIES,
  getDictionary,
  getExpandedMonthRange,
  getGoalTotalsFromTransactions,
} from "@poleursus/shared";
import { toDateKey } from "@/components/home-redesign/utils";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

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
  const dictionary = getDictionary(locale) as any;

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

  const { data: monthlyTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: upcomingTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", upcomingStartDate)
    .lte("date", upcomingEndDate)
    .order("date", { ascending: true });

  const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
    ...row,
    category: Array.isArray(row.category)
      ? (row.category[0] ?? null)
      : (row.category ?? null),
  });

  const normalizedMonthlyTransactions = (monthlyTransactions ?? []).map(
    normalizeCategory
  );
  const normalizedUpcomingTransactions = (upcomingTransactions ?? []).map(
    normalizeCategory
  );

  const { data: obligationsRange } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .gte("due_date", startDate)
    .lte("due_date", obligationsEndDate)
    .order("due_date", { ascending: true });

  const { data: obligationsNoDate } = await supabase
    .from("obligations")
    .select(
      "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
    )
    .eq("account_id", mainAccount.id)
    .is("due_date", null);

  const obligations = [...(obligationsRange ?? []), ...(obligationsNoDate ?? [])];

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", mainAccount.id)
    .eq("status", "active")
    .order("priority", { ascending: true });
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

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(today);
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const todayKey = toDateKey(today);
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthTransactionsToDate = normalizedMonthlyTransactions.filter((tx) => {
    const dateKey = toDateKey(tx.date);
    return Boolean(dateKey) && dateKey.startsWith(monthPrefix) && dateKey <= todayKey;
  });

  const goalTotals = getGoalTotalsFromTransactions(
    monthTransactionsToDate.map((tx) => ({
      type: tx.type,
      amount_minor: tx.amount_minor,
      amount_base_minor: tx.amount_base_minor,
    }))
  );

  const monthlyBalanceMinor =
    goalTotals.incomeTotalMinor - goalTotals.expenseTotalMinor;

  return (
    <div
      className={cn("min-h-screen bg-background", dmSans.className)}
    >
      <TopNav />
      <HomePageClient
        account={{
          id: mainAccount.id,
          canEdit,
          monthlyBalanceMinor: monthlyBalanceMinor.toString(),
          currentMonth: monthLabelCapitalized,
          currencySymbol,
          baseCurrency: mainAccount.base_currency,
        }}
        monthlyTransactions={normalizedMonthlyTransactions}
        upcomingTransactions={normalizedUpcomingTransactions}
        obligations={obligations ?? []}
        profiles={profiles ?? []}
        projects={projects ?? []}
        locale={locale}
        monoClassName={jetbrains.className}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
