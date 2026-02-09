import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { HomePageClient } from "@/components/home-redesign/HomePageClient";
import {
  CURRENCIES,
  computeGoalProgress,
  getExpandedMonthRange,
  getGoalTotalsFromTransactions,
  toMonthKey,
} from "@poleursus/shared";
import { formatCurrencyParts, toDateKey } from "@/components/home-redesign/utils";
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
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";

  if (!cookieAccountId) {
    redirect("/select-account");
  }

  const mainAccount = accounts.find((account) => account.id === cookieAccountId);

  if (!mainAccount) {
    redirect("/select-account");
  }

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
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: upcomingTransactions } = await supabase
    .from("transactions")
    .select(
      "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
    )
    .eq("account_id", mainAccount.id)
    .gte("date", upcomingStartDate)
    .lte("date", upcomingEndDate)
    .order("date", { ascending: true });

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

  const monthKey = toMonthKey(today);
  const { data: goal } = await supabase
    .from("financial_goals")
    .select("id, month, type, target_amount_base_minor")
    .eq("account_id", mainAccount.id)
    .eq("month", monthKey)
    .eq("type", "save")
    .maybeSingle();

  const { data: goalHistory } = await supabase.rpc("get_goal_history", {
    p_account_id: mainAccount.id,
    p_limit: 5,
  });

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === mainAccount.base_currency)
      ?.symbol ?? mainAccount.base_currency;

  const monthLabel = `${[
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ][today.getMonth()] ?? ""} ${today.getFullYear()}`;
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const todayKey = toDateKey(today);
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthTransactionsToDate = (monthlyTransactions ?? []).filter((tx) => {
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
  const progress = computeGoalProgress({
    goal: goal
      ? {
          ...goal,
          account_id: mainAccount.id,
          created_by: user.id,
        }
      : null,
    totals: goalTotals,
    now: today,
  });

  const objective = progress
    ? (() => {
        const targetMinor = progress.targetMinor;
        const currentMinor = progress.savedMinor;
        const progressPercent =
          targetMinor > 0n
            ? Math.min(
                100,
                Math.max(
                  0,
                  (Number(currentMinor) / Number(targetMinor)) * 100
                )
              )
            : 0;
        const expectedPercent =
          targetMinor > 0n
            ? Math.min(
                100,
                Math.max(
                  0,
                  (Number(progress.expectedSavedMinor) / Number(targetMinor)) *
                    100
                )
              )
            : 0;

        let status: "on-track" | "at-risk" | "off-track" = "at-risk";
        if (currentMinor >= targetMinor) {
          status = "on-track";
        } else if (progress.forecastEndMinor < targetMinor) {
          status = "off-track";
        } else if (currentMinor >= progress.expectedSavedMinor) {
          status = "on-track";
        }

        const statusLabel =
          status === "on-track"
            ? "Vas bien"
            : status === "off-track"
            ? "Fuera de objetivo"
            : "En riesgo";

        const targetFormatted = formatCurrencyParts(
          targetMinor,
          currencySymbol
        ).full;
        const forecastFormatted = formatCurrencyParts(
          progress.forecastEndMinor,
          currencySymbol
        ).full;
        const remainingFormatted = formatCurrencyParts(
          progress.remainingMinor,
          currencySymbol
        ).full;

        let message = `Al ritmo actual, terminarás ${monthLabel} con <strong>${forecastFormatted}</strong>.`;
        if (progress.forecastEndMinor < targetMinor) {
          message += ` Necesitas <strong>${remainingFormatted}</strong> más para alcanzar el objetivo.`;
        } else if (currentMinor < progress.expectedSavedMinor) {
          message += " Acelerar tus ahorros te acercaría al objetivo.";
        } else {
          message += " Sigue así para cumplir el objetivo.";
        }

        return {
          status,
          statusLabel,
          description: `Ahorrar ${targetFormatted} en ${monthLabel}`,
          currentMinor: currentMinor.toString(),
          targetMinor: targetMinor.toString(),
          progressPercent,
          expectedPercent,
          messageHtml: message,
          streak: (goalHistory ?? []).map((entry) => ({
            hit: entry.completed === true,
          })),
        };
      })()
    : null;

  return (
    <div
      className={cn("min-h-screen bg-[#FAFAFA]", dmSans.className)}
    >
      <TopNav />
      <HomePageClient
        account={{
          monthlyBalanceMinor: monthlyBalanceMinor.toString(),
          currentMonth: monthLabelCapitalized,
          currencySymbol,
          baseCurrency: mainAccount.base_currency,
        }}
        monthlyTransactions={monthlyTransactions ?? []}
        upcomingTransactions={upcomingTransactions ?? []}
        obligations={obligations ?? []}
        objective={objective}
        locale={locale}
        monoClassName={jetbrains.className}
      />
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
