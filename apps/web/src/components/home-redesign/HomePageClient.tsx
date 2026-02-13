"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Target } from "lucide-react";
import { getExpandedMonthRange, getWeekStrip } from "@poleursus/shared";
import { BalanceHeader } from "./BalanceHeader";
import { Timeline } from "./Timeline";
import { Calendar, type DayDetailData, type DayMovement } from "./Calendar";
import { ObjectiveCard } from "./ObjectiveCard";
import { ProgrammedCard } from "./ProgrammedCard";
import { EmptyStateCard } from "./EmptyStateCard";
import {
  formatCurrencyParts,
  formatFullDate,
  formatShortDate,
  toDateKey,
  toMinor,
} from "./utils";

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
  locale?: string;
  monoClassName?: string;
};

export function HomePageClient({
  account,
  monthlyTransactions,
  upcomingTransactions,
  obligations,
  objective,
  locale = "es",
  monoClassName,
}: HomePageClientProps) {
  const router = useRouter();
  const t = useTranslations();
  const today = new Date();
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekReference, setWeekReference] = useState<Date>(today);
  const [monthReference, setMonthReference] = useState<Date>(today);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(
    toDateKey(today)
  );

  const allTransactions = useMemo(() => {
    const map = new Map<string, TransactionRow>();
    monthlyTransactions.forEach((item) => map.set(item.id, item));
    upcomingTransactions.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [monthlyTransactions, upcomingTransactions]);

  const hasMovements = allTransactions.length > 0 || obligations.length > 0;
  const hasObjective = Boolean(objective);

  const lastMovement = useMemo(() => {
    const past = allTransactions
      .map((tx) => ({
        tx,
        date: new Date(tx.date),
      }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && date <= today)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const item = past[0]?.tx;
    if (!item) return null;
    return {
      name: item.merchant ?? item.category?.name ?? t("mobile.home.movementFallback"),
      amountMinor: toMinor(item.amount_base_minor ?? item.amount_minor),
      date: item.date,
      type: item.type,
    };
  }, [allTransactions, today, t]);

  const nextMovement = useMemo(() => {
    const future = allTransactions
      .map((tx) => ({
        tx,
        date: new Date(tx.date),
      }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && date > today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const item = future[0]?.tx;
    if (!item) return null;
    return {
      name: item.merchant ?? item.category?.name ?? t("mobile.home.movementFallback"),
      amountMinor: toMinor(item.amount_base_minor ?? item.amount_minor),
      date: item.date,
      type: item.type,
    };
  }, [allTransactions, today, t]);

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
  }, [weekStrip.weekRange]);

  const weekData = useMemo(() => {
    const netIncome = formatCurrencyParts(
      weekTotals.income,
      account.currencySymbol
    ).full;
    const netExpense = formatCurrencyParts(
      weekTotals.expense,
      account.currencySymbol
    ).full;
    const net = formatCurrencyParts(
      weekTotals.net,
      account.currencySymbol
    ).full;

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
      if (!obligation.due_date) return;
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
      if (!obligation.due_date) return;
      if (toDateKey(obligation.due_date) !== selectedDayKey) return;
      movements.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(
          obligation.amount_base_minor ?? obligation.amount_minor
        ),
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

  const programmedItems = useMemo(() => {
    const items: {
      id: string;
      name: string;
      amountMinor: bigint;
      date: Date;
      type: "income" | "expense";
    }[] = [];

    upcomingTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      items.push({
        id: tx.id,
        name: tx.merchant ?? tx.category?.name ?? t("mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        date,
        type: tx.type,
      });
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date) return;
      if (obligation.status === "paid") return;
      const date = new Date(obligation.due_date);
      if (Number.isNaN(date.getTime())) return;
      if (date < today) return;
      items.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(
          obligation.amount_base_minor ?? obligation.amount_minor
        ),
        date,
        type: "expense",
      });
    });

    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        name: item.name,
        amountMinor: item.amountMinor,
        type: item.type,
        dateLabel: formatShortDate(item.date, locale),
      }));
  }, [upcomingTransactions, obligations, today, locale, t]);

  const handleSelectDay = (dateKey: string) => {
    setSelectedDayKey(dateKey);
  };

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
        <div className="flex flex-col gap-6">
          {hasMovements ? (
            <>
              <Timeline
                last={lastMovement}
                next={nextMovement}
                currencySymbol={account.currencySymbol}
                locale={locale}
                monoClassName={monoClassName}
              />
              <Calendar
                view={calendarView}
                onViewChange={setCalendarView}
                weekData={weekData}
                monthData={monthData}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                onPrevPeriod={handlePrevPeriod}
                onNextPeriod={handleNextPeriod}
                currencySymbol={account.currencySymbol}
                locale={locale}
                monoClassName={monoClassName}
              />
            </>
          ) : (
            <EmptyStateCard
              icon="📝"
              title={t("mobile.home.emptyMovementsTitle")}
              description={t("mobile.home.emptyMovementsDescription")}
              buttonLabel={t("mobile.home.emptyMovementsCta")}
              onAction={() => router.push("/transactions?new=1")}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {hasObjective ? (
            <ObjectiveCard
              objective={objective}
              onNavigate={() => router.push("/goal")}
              currencySymbol={account.currencySymbol}
              locale={locale}
              monoClassName={monoClassName}
            />
          ) : (
            <EmptyStateCard
              icon={<Target className="h-5 w-5 text-muted-foreground" />}
              title={t("mobile.home.emptyGoalTitle")}
              description={t("mobile.home.emptyGoalDescription")}
              buttonLabel={t("mobile.home.emptyGoalCta")}
              onAction={() => router.push("/goal")}
            />
          )}

          {hasMovements && programmedItems.length > 0 ? (
            <ProgrammedCard
              items={programmedItems}
              onViewAll={() =>
                router.push("/transactions?filter=programmed")
              }
              currencySymbol={account.currencySymbol}
              locale={locale}
              monoClassName={monoClassName}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
