"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  computeProjectProgress,
  getExpandedMonthRange,
  getProjectWidgetState,
  getWeekStrip,
  type Project,
  type ProjectContribution,
} from "@poleursus/shared";
import {
  Calendar,
  type DayDetailData,
  type DayMovement,
  type NextProgrammedItem,
} from "./Calendar";
import { BalanceHeader } from "./BalanceHeader";
import { ProjectObjectiveWidget } from "./ProjectObjectiveWidget";
import { formatCurrencyParts, formatFullDate, formatShortDate, toDateKey, toMinor } from "./utils";

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
  merchant: string | null;
  category?: {
    id: string;
    name: string;
    icon_id: string | null;
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

type ObjectiveData = {
  status: "on-track" | "at-risk" | "off-track";
  statusLabel: string;
  description: string;
  currentMinor: string;
  targetMinor: string;
  progressPercent: number;
  expectedPercent: number;
  messageHtml: string;
  streak: Array<{ hit: boolean }>;
};

type HomePageClientProps = {
  account: {
    monthlyBalanceMinor: string;
    currentMonth: string;
    currencySymbol: string;
    baseCurrency: string;
  };
  monthlyTransactions: TransactionRow[];
  upcomingTransactions: TransactionRow[];
  obligations: ObligationRow[];
  objective: ObjectiveData | null;
  projects: Project[];
  projectContributions: ProjectContribution[];
  locale?: string;
  monoClassName?: string;
};

export function HomePageClient({
  account,
  monthlyTransactions,
  upcomingTransactions,
  obligations,
  objective,
  projects,
  projectContributions,
  locale = "es",
  monoClassName,
}: HomePageClientProps) {
  const router = useRouter();
  const t = useTranslations();
  const today = useMemo(() => new Date(), []);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekReference, setWeekReference] = useState<Date>(today);
  const [monthReference, setMonthReference] = useState<Date>(today);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(toDateKey(today));

  const allTransactions = useMemo(() => {
    const map = new Map<string, TransactionRow>();
    monthlyTransactions.forEach((item) => map.set(item.id, item));
    upcomingTransactions.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [monthlyTransactions, upcomingTransactions]);

  const contributionsByProject = useMemo(() => {
    const map = new Map<string, ProjectContribution[]>();
    projectContributions.forEach((contribution) => {
      const list = map.get(contribution.project_id) ?? [];
      list.push(contribution);
      map.set(contribution.project_id, list);
    });
    return map;
  }, [projectContributions]);

  const projectWidgetState = useMemo(() => getProjectWidgetState(projects), [projects]);

  const activeProject = useMemo(() => {
    if (projectWidgetState.state !== "active") return null;

    const project = projectWidgetState.project;
    const progress = computeProjectProgress({
      project,
      contributions: contributionsByProject.get(project.id) ?? [],
    });

    let monthlyImpactPercent = 0;
    if (objective && progress.targetMinor > 0n) {
      const ratio =
        Number(toMinor(objective.currentMinor)) / Number(progress.targetMinor);
      if (Number.isFinite(ratio) && ratio > 0) {
        monthlyImpactPercent = Math.max(0, Math.round(ratio * 100));
      }
    }

    return {
      project,
      progress,
      monthlyImpactPercent,
    };
  }, [projectWidgetState, contributionsByProject, objective]);

  const weekStrip = useMemo(() => {
    return getWeekStrip(
      obligations.map((item) => ({
        id: item.id,
        due_date: item.due_date,
        status: item.status ?? "pending",
      })) as any,
      allTransactions.map((item) => ({
        id: item.id,
        type: item.type,
        amount_minor: item.amount_minor,
        amount_base_minor: item.amount_base_minor,
        date: item.date,
      })) as any,
      today,
      weekReference
    );
  }, [allTransactions, obligations, today, weekReference]);

  const weekTotals = useMemo(() => {
    let income = 0n;
    let expense = 0n;
    const start = weekStrip.weekRange.start;
    const end = weekStrip.weekRange.end;
    allTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      if (date < start || date > end) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      if (tx.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });
    return { income, expense, net: income - expense };
  }, [allTransactions, weekStrip.weekRange]);

  const weekPeriodLabel = useMemo(() => {
    const start = weekStrip.weekRange.start;
    const end = weekStrip.weekRange.end;
    const monthShortFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
    const startMonth = monthShortFormatter.format(start).replace(".", "");
    const endMonth = monthShortFormatter.format(end).replace(".", "");
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${endMonth}`;
    }
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
  }, [weekStrip.weekRange, locale]);

  const weekData = useMemo(() => {
    const netIncome = formatCurrencyParts(weekTotals.income, account.currencySymbol).full;
    const netExpense = formatCurrencyParts(weekTotals.expense, account.currencySymbol).full;
    const net = formatCurrencyParts(weekTotals.net, account.currencySymbol).full;

    return {
      days: weekStrip.days.map((day) => ({
        date: day.dayKey,
        dayLabel: new Intl.DateTimeFormat(locale, { weekday: "short" })
          .format(new Date(`${day.dayKey}T00:00:00`))
          .replace(".", ""),
        dayNumber: day.dayOfMonth,
        isToday: day.isToday,
        dots: day.dots.map((dot): { type: "income" | "expense" } => ({
          type: dot.type === "income" ? "income" : "expense",
        })),
      })),
      period: weekPeriodLabel,
      netIncome,
      netExpense,
      net,
    };
  }, [weekStrip.days, weekTotals, account.currencySymbol, weekPeriodLabel, locale]);

  const monthData = useMemo(() => {
    const monthRange = getExpandedMonthRange(monthReference);
    const dotsMap = new Map<string, Array<{ type: "income" | "expense" }>>();

    const addDot = (dateKey: string, type: "income" | "expense") => {
      const existing = dotsMap.get(dateKey) ?? [];
      existing.push({ type });
      dotsMap.set(dateKey, existing);
    };

    allTransactions.forEach((tx) => {
      const key = toDateKey(tx.date);
      if (!key) return;
      addDot(key, tx.type === "income" ? "income" : "expense");
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      const key = toDateKey(obligation.due_date);
      if (!key) return;
      addDot(key, "expense");
    });

    const days = [] as {
      date: string;
      dayNumber: number;
      isToday: boolean;
      isOtherMonth: boolean;
      dots: Array<{ type: "income" | "expense" }>;
    }[];

    const cursor = new Date(monthRange.start);
    while (cursor <= monthRange.end) {
      const key = toDateKey(cursor);
      const isOtherMonth = cursor.getMonth() !== monthReference.getMonth();
      days.push({
        date: key,
        dayNumber: cursor.getDate(),
        isToday: toDateKey(cursor) === toDateKey(today),
        isOtherMonth,
        dots: dotsMap.get(key) ?? [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const monthLabel = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(monthReference);

    return {
      days,
      period: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    };
  }, [allTransactions, obligations, monthReference, today, locale]);

  const selectedDay = useMemo<DayDetailData | null>(() => {
    if (!selectedDayKey) return null;
    const dayDate = new Date(selectedDayKey);
    if (Number.isNaN(dayDate.getTime())) return null;

    const movements: DayMovement[] = [];

    allTransactions.forEach((tx) => {
      if (toDateKey(tx.date) !== selectedDayKey) return;
      movements.push({
        id: tx.id,
        name: tx.merchant ?? tx.category?.name ?? t("mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        type: tx.type,
        category: tx.category?.name ?? null,
        badge: null,
      });
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      if (toDateKey(obligation.due_date) !== selectedDayKey) return;
      movements.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        type: "expense",
        category: t("mobile.home.programmedBadge"),
        badge: t("mobile.home.programmedBadge"),
      });
    });

    return {
      dateKey: selectedDayKey,
      formattedLabel: formatFullDate(dayDate, locale),
      movements,
    };
  }, [selectedDayKey, allTransactions, obligations, locale, t]);

  const scheduledItems = useMemo(() => {
    const items: Array<NextProgrammedItem & { dateKey: string }> = [];

    upcomingTransactions.forEach((tx) => {
      const dateKey = toDateKey(tx.date);
      if (!dateKey) return;
      items.push({
        id: tx.id,
        name: tx.merchant ?? tx.category?.name ?? t("mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        type: tx.type,
        dateKey,
        dateLabel: formatShortDate(dateKey, locale),
        category: tx.category?.name ?? null,
      });
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      const dateKey = toDateKey(obligation.due_date);
      if (!dateKey) return;
      items.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        type: "expense",
        dateKey,
        dateLabel: formatShortDate(dateKey, locale),
        category: t("mobile.home.programmedBadge"),
      });
    });

    return items.sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  }, [upcomingTransactions, obligations, locale, t]);

  const nextProgrammed = useMemo(() => {
    const key = selectedDayKey ?? toDateKey(today);
    return scheduledItems.find((item) => item.dateKey > key) ?? null;
  }, [scheduledItems, selectedDayKey, today]);

  const handlePrevPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() - 7);
      setWeekReference(next);
    } else {
      const next = new Date(monthReference);
      next.setMonth(next.getMonth() - 1);
      setMonthReference(next);
    }
  };

  const handleNextPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() + 7);
      setWeekReference(next);
    } else {
      const next = new Date(monthReference);
      next.setMonth(next.getMonth() + 1);
      setMonthReference(next);
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-20 pt-8 sm:px-10">
      <BalanceHeader
        amountMinor={toMinor(account.monthlyBalanceMinor)}
        monthLabel={account.currentMonth}
        currencySymbol={account.currencySymbol}
        locale={locale}
        monoClassName={monoClassName}
      />

      <div className="grid grid-cols-1 items-start gap-6 min-[900px]:grid-cols-[1fr_340px]">
        <Calendar
          view={calendarView}
          onViewChange={setCalendarView}
          weekData={weekData}
          monthData={monthData}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDayKey}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          currencySymbol={account.currencySymbol}
          nextProgrammed={nextProgrammed}
          onViewAllProgrammed={() => router.push("/transactions?filter=programmed")}
          locale={locale}
          monoClassName={monoClassName}
        />

        <ProjectObjectiveWidget
          widgetState={projectWidgetState}
          activeProject={activeProject}
          objective={objective}
          onViewProject={(projectId) => router.push(`/projects/${projectId}`)}
          onCreateProject={() => router.push("/projects")}
          onCreateGoal={() => router.push("/goal")}
          currencySymbol={account.currencySymbol}
          locale={locale}
          monoClassName={monoClassName}
        />
      </div>
    </div>
  );
}
