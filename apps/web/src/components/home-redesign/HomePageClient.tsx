"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCalendarDayData,
  getMonthCalendarDisplayDays,
  getWeekCalendarDisplayDays,
  getWeekStartMonday,
} from "@poleursus/shared";
import { PageContainer } from "@/components/layout/page-container";
import { AddActionTrigger } from "@/components/navigation/add-action-trigger";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "./Calendar";
import { toDateKey } from "./utils";

type TransactionRow = {
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

type ObligationRow = {
  id: string;
  name: string;
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  due_date: string | null;
  status: "pending" | "paid" | null;
};

type HomePageClientProps = {
  account: {
    id: string;
    canEdit: boolean;
    currencySymbol: string;
    baseCurrency: string;
    locale: "es" | "en";
  };
  monthlyTransactions: TransactionRow[];
  upcomingTransactions: TransactionRow[];
  obligations: ObligationRow[];
  summary: {
    balanceMinor: string;
    monthlySavingsMinor: string;
    monthlyIncomeMinor: string;
    monthlyExpensesMinor: string;
    availableMinor: string;
    currentMonth: string;
    topProjects: Array<{
      id: string;
      name: string;
      emoji: string;
      color: string;
      goalAmount: string;
      totalContributed: string;
      estimatedCompletion: string | null;
      progressRatio: number;
      priority: number;
    }>;
  };
};

const plusDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const WEEKDAY_LABELS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const MONTHS_SHORT = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
};

const MONTHS_LONG = {
  es: [
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
  ],
  en: [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ],
};

const TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const etaFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});

const formatMinorCurrency = (value: string | number | bigint | null | undefined) => {
  if (value === null || value === undefined) return euroFormatter.format(0);
  const amount = typeof value === "bigint" ? Number(value) : Number(value);
  return euroFormatter.format(Number.isFinite(amount) ? amount / 100 : 0);
};

const formatEta = (value: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return etaFormatter.format(date);
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

function ProjectRing({
  progress,
  color,
  radius,
  strokeWidth,
  emoji,
}: {
  progress: number;
  color: string;
  radius: number;
  strokeWidth: number;
  emoji: string;
}) {
  const normalized = clampProgress(progress);
  const size = radius * 2 + strokeWidth * 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalized);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px]">
        {emoji}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  accent = "default",
}: {
  label: string;
  value: string;
  sublabel: string;
  accent?: "default" | "highlight" | "income" | "expense";
}) {
  const accentClass =
    accent === "highlight"
      ? "border-[rgba(91,141,255,0.2)] bg-[rgba(91,141,255,0.06)]"
      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]";
  const valueClass = accent === "highlight" ? "text-[#5B8DFF]" : "text-white";
  const sublabelClass =
    accent === "income"
      ? "text-[#4ade80]"
      : accent === "expense"
        ? "text-[#f87171]"
        : "text-[rgba(255,255,255,0.32)]";

  return (
    <div className={`rounded-[14px] border px-[18px] py-4 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
        {label}
      </p>
      <p className={`mt-1 text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className={`mt-[7px] text-[11px] ${sublabelClass}`}>{sublabel}</p>
    </div>
  );
}

export function HomePageClient({
  account,
  monthlyTransactions,
  upcomingTransactions,
  obligations,
  summary,
}: HomePageClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const locale = account.locale;
  const weekdayLabels = WEEKDAY_LABELS[locale];
  const monthsShort = MONTHS_SHORT[locale];
  const monthsLong = MONTHS_LONG[locale];
  const today = useMemo(() => new Date(), []);
  const [transactions, setTransactions] = useState<TransactionRow[]>(monthlyTransactions);
  const [futureTransactions, setFutureTransactions] = useState<TransactionRow[]>(upcomingTransactions);
  const [calendarObligations, setCalendarObligations] = useState<ObligationRow[]>(obligations);
  const [calendarView, setCalendarView] = useState<"week" | "month">("month");
  const [weekReference, setWeekReference] = useState<Date>(today);
  const [monthReference, setMonthReference] = useState<Date>(today);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(today));

  useEffect(() => {
    let cancelled = false;

    const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
      ...row,
      category: Array.isArray(row.category)
        ? (row.category[0] ?? null)
        : (row.category ?? null),
    });

    const loadCalendarData = async () => {
      const monthStart = new Date(monthReference.getFullYear(), monthReference.getMonth(), 1);
      const monthEnd = new Date(monthReference.getFullYear(), monthReference.getMonth() + 1, 0);
      const monthGridStart = getWeekStartMonday(monthStart);
      const monthGridEnd = plusDays(getWeekStartMonday(plusDays(monthEnd, 1)), 6);
      const weekStart = getWeekStartMonday(weekReference);
      const weekEnd = plusDays(weekStart, 6);

      const queryStart = monthGridStart < weekStart ? monthGridStart : weekStart;
      const queryEnd = monthGridEnd > weekEnd ? monthGridEnd : weekEnd;
      const startDate = toDateKey(queryStart);
      const endDate = toDateKey(queryEnd);
      const upcomingStartDate = toDateKey(today);
      const upcomingEndDate = toDateKey(plusDays(today, 30));

      try {
        const loadTransactions = async ({
          start,
          end,
          ascending,
        }: {
          start: string;
          end: string;
          ascending: boolean;
        }) => {
          const runQuery = (selectClause: string) => {
            let query = supabase
              .from("transactions")
              .select(selectClause)
              .eq("account_id", account.id)
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
              "[HomePageClient][web] categories.color missing, retrying transactions query without color."
            );
            ({ data, error } = await runQuery(TRANSACTIONS_SELECT_LEGACY));
          }

          if (error) throw error;

          const rows = (data ?? []) as unknown as Array<TransactionRow & { category?: unknown }>;
          return rows.map(normalizeCategory) as TransactionRow[];
        };

        const [monthData, upcomingData, obligationsData] = await Promise.all([
          loadTransactions({
            start: startDate,
            end: endDate,
            ascending: false,
          }),
          loadTransactions({
            start: upcomingStartDate,
            end: upcomingEndDate,
            ascending: true,
          }),
          supabase
            .from("obligations")
            .select(
              "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
            )
            .eq("account_id", account.id)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .order("due_date", { ascending: true }),
        ]);

        if (cancelled) return;
        setTransactions(monthData);
        setFutureTransactions(upcomingData);
        setCalendarObligations((obligationsData.data ?? []) as ObligationRow[]);
      } catch (error) {
        console.error("[HomePageClient][web] load calendar error:", error);
      }
    };

    void loadCalendarData();

    return () => {
      cancelled = true;
    };
  }, [account.id, monthReference, weekReference, supabase, today]);

  const allTransactions = useMemo(() => {
    const map = new Map<string, TransactionRow>();
    transactions.forEach((item) => map.set(item.id, item));
    futureTransactions.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [transactions, futureTransactions]);

  const todayKey = toDateKey(today);
  const calendarMap = useMemo(() => {
    const entries = [
      ...allTransactions.map((tx) => ({
        date: tx.date,
        type: tx.type,
        amount_minor: tx.amount_minor,
        amount_base_minor: tx.amount_base_minor,
        category_id: tx.category?.id ?? null,
        category_name: tx.category?.name ?? null,
        category_color: tx.category?.color ?? null,
      })),
      ...calendarObligations
        .filter((obligation) => obligation.status !== "paid" && Boolean(obligation.due_date))
        .map((obligation) => ({
          date: obligation.due_date as string,
          type: "expense" as const,
          amount_minor: obligation.amount_minor,
          amount_base_minor: obligation.amount_base_minor,
          category_id: "obligation",
          category_name: locale === "en" ? "Scheduled" : "Programado",
          category_color: "#CB6E55",
        })),
    ];

    return buildCalendarDayData(entries);
  }, [allTransactions, calendarObligations, locale]);

  const monthDays = useMemo(() => {
    return getMonthCalendarDisplayDays(
      calendarMap,
      monthReference.getFullYear(),
      monthReference.getMonth(),
      todayKey,
      weekdayLabels
    );
  }, [calendarMap, monthReference, todayKey, weekdayLabels]);

  const weekDays = useMemo(() => {
    return getWeekCalendarDisplayDays(calendarMap, weekReference, todayKey, weekdayLabels);
  }, [calendarMap, weekReference, todayKey, weekdayLabels]);

  const weekPeriodLabel = useMemo(() => {
    const monday = getWeekStartMonday(weekReference);
    const sunday = plusDays(monday, 6);
    const startMonth = monthsShort[monday.getMonth()] ?? "";
    const endMonth = monthsShort[sunday.getMonth()] ?? "";
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()}–${sunday.getDate()} ${endMonth}`;
    }
    return `${monday.getDate()} ${startMonth} – ${sunday.getDate()} ${endMonth}`;
  }, [weekReference, monthsShort]);

  const monthPeriodLabel = useMemo(() => {
    const monthName = monthsLong[monthReference.getMonth()] ?? "";
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthReference.getFullYear()}`;
  }, [monthReference, monthsLong]);

  const monthlyIncomeLabel = formatMinorCurrency(summary.monthlyIncomeMinor);
  const monthlyExpensesLabel = formatMinorCurrency(summary.monthlyExpensesMinor);
  const monthlySavingsLabel = formatMinorCurrency(summary.monthlySavingsMinor);
  const balanceLabel = formatMinorCurrency(summary.balanceMinor);
  const availableLabel = formatMinorCurrency(summary.availableMinor);
  const currentMonthShort = summary.currentMonth.split(" ")[0]?.toUpperCase() ?? "";

  return (
    <PageContainer className="pb-20 pt-7">
      <div className="space-y-4">
        <div className="md:hidden">
          <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  ESTE MES
                </p>
                <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.35)]">{summary.currentMonth}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  AHORRO
                </p>
                <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.05em] text-[#5B8DFF] tabular-nums">
                  {monthlySavingsLabel}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
              <div className="px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  INGRESOS
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#4ade80] tabular-nums">
                  ↑ {monthlyIncomeLabel}
                </p>
              </div>
              <div className="border-x border-[rgba(255,255,255,0.08)] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  GASTOS
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#f87171] tabular-nums">
                  ↓ {monthlyExpensesLabel}
                </p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  QUEDA
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#5B8DFF] tabular-nums">
                  {availableLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden grid-cols-4 gap-3 md:grid">
          <StatCard label="BALANCE" value={balanceLabel} sublabel="Patrimonio total" />
          <StatCard
            label={`AHORRO · ${currentMonthShort}`}
            value={monthlySavingsLabel}
            sublabel={`De ${monthlyIncomeLabel} ingresados`}
            accent="highlight"
          />
          <StatCard label="INGRESOS" value={monthlyIncomeLabel} sublabel="↑ Este mes" accent="income" />
          <StatCard label="GASTOS" value={monthlyExpensesLabel} sublabel="↓ Este mes" accent="expense" />
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
          <div>
            <div className="md:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[12px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                  PROYECTOS
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-[12px] text-[#5B8DFF]"
                >
                  Ver todos →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {summary.topProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.04)] px-2 py-3 text-center"
                  >
                    <div className="flex justify-center">
                      <ProjectRing
                        progress={project.progressRatio}
                        color={project.color}
                        radius={22}
                        strokeWidth={4}
                        emoji={project.emoji}
                      />
                    </div>
                    <p className="mx-auto mt-2 line-clamp-2 min-h-[28px] text-[11px] font-medium text-[rgba(255,255,255,0.82)]">
                      {project.name}
                    </p>
                    <p className="mt-1 text-[10px] leading-[1.3] text-[rgba(255,255,255,0.35)]">
                      Llegas en <span className="font-medium text-[#5B8DFF]">{formatEta(project.estimatedCompletion)}</span>
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 md:block">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.35)]">
                  PROYECTOS
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-[12px] text-[#5B8DFF]"
                >
                  Ver todos →
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {summary.topProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="flex w-full items-center gap-3 rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-[14px] py-3 text-left"
                  >
                    <ProjectRing
                      progress={project.progressRatio}
                      color={project.color}
                      radius={18}
                      strokeWidth={3.5}
                      emoji={project.emoji}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[rgba(255,255,255,0.86)]">
                        {project.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.35)]">
                        Llegas en {formatEta(project.estimatedCompletion)}
                      </p>
                    </div>
                    <p className="text-[20px] font-semibold text-[rgba(255,255,255,0.28)] tabular-nums">
                      {Math.round(clampProgress(project.progressRatio) * 100)}%
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Calendar
              view={calendarView}
              onViewChange={setCalendarView}
              periodLabel={calendarView === "week" ? weekPeriodLabel : monthPeriodLabel}
              monthDays={monthDays}
              weekDays={weekDays}
              selectedDayKey={selectedDayKey}
              onSelectDay={setSelectedDayKey}
              onPrevPeriod={handlePrevPeriod}
              onNextPeriod={handleNextPeriod}
              currencySymbol={account.currencySymbol}
            />
          </div>
        </div>
      </div>

      <AddActionTrigger canEdit={account.canEdit} accountId={account.id} variant="hidden" />
    </PageContainer>
  );

  function handlePrevPeriod() {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() - 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() - 7);
        return toDateKey(currentDate);
      });
      return;
    }

    const next = new Date(monthReference);
    next.setMonth(next.getMonth() - 1);
    setMonthReference(next);
  }

  function handleNextPeriod() {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() + 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() + 7);
        return toDateKey(currentDate);
      });
      return;
    }

    const next = new Date(monthReference);
    next.setMonth(next.getMonth() + 1);
    setMonthReference(next);
  }
}
