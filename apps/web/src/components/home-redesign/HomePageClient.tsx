"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { useCachedObligationsRange, useCachedTransactionsRange } from "@/cache/hooks";
import {
  CORE_5M,
  type AvatarColorToken,
  cacheKeys,
  cacheTags,
  computeMovementBalanceSummary,
  computeSavingsDistribution,
  formatMoneyWithSymbol,
  getExpandedMonthRange,
  getWeekStrip,
  type Project,
  type UserAvatarColorId,
} from "@poleursus/shared";
import {
  Calendar,
  type ContextMovement,
  type DayDetailData,
  type DayMovement,
} from "./Calendar";
import { BalanceHeader } from "./BalanceHeader";
import { SavingsMonthCard } from "./SavingsMonthCard";
import { PageContainer } from "@/components/layout/page-container";
import { AddActionTrigger } from "@/components/navigation/add-action-trigger";
import { formatCurrencyParts, formatFullDate, formatShortDate, toDateKey, toMinor } from "./utils";

type TransactionRow = {
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
  } | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
  avatar_color: UserAvatarColorId | null;
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
    monthlyBalanceMinor: string;
    currentMonth: string;
    currencySymbol: string;
    baseCurrency: string;
  };
  monthlyTransactions: TransactionRow[];
  upcomingTransactions: TransactionRow[];
  obligations: ObligationRow[];
  profiles: ProfileRow[];
  projects: Project[];
  locale?: string;
  monoClassName?: string;
};

export function HomePageClient({
  account,
  monthlyTransactions,
  upcomingTransactions,
  obligations,
  profiles,
  projects,
  locale = "es",
  monoClassName,
}: HomePageClientProps) {
  const router = useRouter();
  const t = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const { cache, userId } = useWebDataCache();
  const loadCachedTransactionsRange = useCachedTransactionsRange();
  const loadCachedObligationsRange = useCachedObligationsRange();
  const openAddActionRef = useRef<(() => void) | null>(null);
  const skipInitialFetchRef = useRef(true);
  const today = useMemo(() => new Date(), []);
  const [monthTransactions, setMonthTransactions] = useState<TransactionRow[]>(
    monthlyTransactions
  );
  const [futureTransactions, setFutureTransactions] = useState<TransactionRow[]>(
    upcomingTransactions
  );
  const [calendarObligations, setCalendarObligations] = useState<ObligationRow[]>(
    obligations
  );
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekReference, setWeekReference] = useState<Date>(today);
  const [monthReference, setMonthReference] = useState<Date>(today);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(toDateKey(today));
  const todayKey = toDateKey(today);

  useEffect(() => {
    if (!userId) return;

    const expandedRange = getExpandedMonthRange(today);
    const startDate = expandedRange.start.toISOString().slice(0, 10);
    const endDate = expandedRange.end.toISOString().slice(0, 10);
    const upcomingEnd = new Date(today);
    upcomingEnd.setDate(upcomingEnd.getDate() + 30);
    const upcomingStartDate = today.toISOString().slice(0, 10);
    const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);
    const obligationsEnd =
      upcomingEnd > expandedRange.end ? upcomingEnd : expandedRange.end;
    const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
    const now = Date.now();

    void cache.prime({
      version: 1,
      userId,
      accountId: account.id,
      key: cacheKeys.transactionsRange(account.id, startDate, endDate),
      data: monthlyTransactions,
      updatedAt: now,
      staleAt: now + CORE_5M.staleMs,
      expiresAt: now + CORE_5M.expireMs,
      tags: [cacheTags.transactions, cacheTags.homeCalendar],
    });

    void cache.prime({
      version: 1,
      userId,
      accountId: account.id,
      key: cacheKeys.transactionsRange(account.id, upcomingStartDate, upcomingEndDate),
      data: upcomingTransactions,
      updatedAt: now,
      staleAt: now + CORE_5M.staleMs,
      expiresAt: now + CORE_5M.expireMs,
      tags: [cacheTags.transactions, cacheTags.homeCalendar],
    });

    void cache.prime({
      version: 1,
      userId,
      accountId: account.id,
      key: cacheKeys.obligationsRange(account.id, startDate, obligationsEndDate),
      data: obligations.filter((item) => Boolean(item.due_date)),
      updatedAt: now,
      staleAt: now + CORE_5M.staleMs,
      expiresAt: now + CORE_5M.expireMs,
      tags: [cacheTags.obligations, cacheTags.homeCalendar],
    });
  }, [
    account.id,
    cache,
    obligations,
    monthlyTransactions,
    upcomingTransactions,
    today,
    userId,
  ]);

  useEffect(() => {
    // Initial month data already comes from SSR props.
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }

    let cancelled = false;

    const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
      ...row,
      category: Array.isArray(row.category)
        ? (row.category[0] ?? null)
        : (row.category ?? null),
    });

    async function loadCalendarData() {
      const expandedRange = getExpandedMonthRange(monthReference);
      const startDate = expandedRange.start.toISOString().slice(0, 10);
      const endDate = expandedRange.end.toISOString().slice(0, 10);
      const now = new Date();
      const upcomingEnd = new Date(now);
      upcomingEnd.setDate(upcomingEnd.getDate() + 30);
      const obligationsEnd =
        upcomingEnd > expandedRange.end ? upcomingEnd : expandedRange.end;
      const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
      const upcomingStartDate = now.toISOString().slice(0, 10);
      const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);

      try {
        const [monthData, upcomingData, obligationsRange] = await Promise.all([
          loadCachedTransactionsRange<TransactionRow[]>({
            accountId: account.id,
            start: startDate,
            end: endDate,
            loader: async () => {
              const { data, error } = await supabase
                .from("transactions")
                .select(
                  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
                )
                .eq("account_id", account.id)
                .gte("date", startDate)
                .lte("date", endDate)
                .order("date", { ascending: false })
                .order("created_at", { ascending: false });
              if (error) throw error;
              return (data ?? []).map(normalizeCategory) as TransactionRow[];
            },
          }),
          loadCachedTransactionsRange<TransactionRow[]>({
            accountId: account.id,
            start: upcomingStartDate,
            end: upcomingEndDate,
            loader: async () => {
              const { data, error } = await supabase
                .from("transactions")
                .select(
                  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
                )
                .eq("account_id", account.id)
                .gte("date", upcomingStartDate)
                .lte("date", upcomingEndDate)
                .order("date", { ascending: true });
              if (error) throw error;
              return (data ?? []).map(normalizeCategory) as TransactionRow[];
            },
          }),
          loadCachedObligationsRange<ObligationRow[]>({
            accountId: account.id,
            start: startDate,
            end: obligationsEndDate,
            loader: async () => {
              const { data, error } = await supabase
                .from("obligations")
                .select(
                  "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
                )
                .eq("account_id", account.id)
                .gte("due_date", startDate)
                .lte("due_date", obligationsEndDate)
                .order("due_date", { ascending: true });
              if (error) throw error;
              return (data ?? []) as ObligationRow[];
            },
          }),
        ]);

        if (cancelled) return;
        setMonthTransactions(monthData ?? []);
        setFutureTransactions(upcomingData ?? []);
        setCalendarObligations(obligationsRange ?? []);
      } catch (error) {
        console.error("[HomePageClient] Error loading calendar data:", error);
      }
    }

    void loadCalendarData();

    return () => {
      cancelled = true;
    };
  }, [
    account.id,
    monthReference,
    supabase,
    loadCachedTransactionsRange,
    loadCachedObligationsRange,
  ]);

  const allTransactions = useMemo(() => {
    const map = new Map<string, TransactionRow>();
    monthTransactions.forEach((item) => map.set(item.id, item));
    futureTransactions.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [monthTransactions, futureTransactions]);
  const profilesByUserId = useMemo(
    () =>
      profiles.reduce<Record<string, ProfileRow>>((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {}),
    [profiles]
  );

  const resolveMovementCreator = useMemo(
    () => (createdBy?: string | null) => {
      if (!createdBy) return undefined;
      const profile = profilesByUserId[createdBy];
      const fallbackName =
        profile?.display_name?.trim() ||
        profile?.email?.trim() ||
        createdBy.slice(0, 6);
      return {
        userId: createdBy,
        email: profile?.email ?? null,
        displayName: profile?.display_name ?? fallbackName,
        avatarPath: profile?.avatar_path ?? null,
        fallbackText: profile?.avatar_fallback_text ?? null,
        fallbackBgToken: profile?.avatar_fallback_bg_token ?? null,
        avatarColor: profile?.avatar_color ?? null,
        label: fallbackName,
      };
    },
    [profilesByUserId]
  );

  const selectedMonthReference = calendarView === "month" ? monthReference : weekReference;
  const selectedMonthKey = useMemo(() => {
    const year = selectedMonthReference.getFullYear();
    const month = String(selectedMonthReference.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [selectedMonthReference]);
  const selectedMonthBalanceMinor = useMemo(() => {
    const selectedMonthTransactions = allTransactions.filter((tx) => {
      const dateKey = toDateKey(tx.date);
      return Boolean(dateKey) && dateKey.startsWith(selectedMonthKey);
    });
    return computeMovementBalanceSummary(selectedMonthTransactions).totalBalanceMinor;
  }, [allTransactions, selectedMonthKey]);

  const savingsMinor = toMinor(account.monthlyBalanceMinor);
  const savingsDistribution = useMemo(
    () =>
      computeSavingsDistribution({
        projects,
        savingsMinor,
      }),
    [projects, savingsMinor]
  );

  const savingsMessage = useMemo(() => {
    if (savingsDistribution.status === "no_savings") {
      return t("home.savings.noSavings");
    }
    if (savingsDistribution.status === "needs_projects") {
      return t("home.savings.needsProjects", {
        amount: formatMoneyWithSymbol(
          savingsDistribution.gapToObjectiveMinor,
          account.baseCurrency,
          account.currencySymbol
        ),
      });
    }
    return t("home.savings.toHucha", {
      amount: formatMoneyWithSymbol(
        savingsDistribution.huchaMinor,
        account.baseCurrency,
        account.currencySymbol
      ),
    });
  }, [account.baseCurrency, account.currencySymbol, savingsDistribution, t]);

  const weekStrip = useMemo(() => {
    return getWeekStrip(
      calendarObligations.map((item) => ({
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
  }, [allTransactions, calendarObligations, today, weekReference]);

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
    const monthKey = `${monthReference.getFullYear()}-${String(
      monthReference.getMonth() + 1
    ).padStart(2, "0")}`;
    let monthIncome = 0n;
    let monthExpense = 0n;

    const addDot = (dateKey: string, type: "income" | "expense") => {
      const existing = dotsMap.get(dateKey) ?? [];
      existing.push({ type });
      dotsMap.set(dateKey, existing);
    };

    allTransactions.forEach((tx) => {
      const key = toDateKey(tx.date);
      if (!key) return;
      addDot(key, tx.type === "income" ? "income" : "expense");
      if (!key.startsWith(monthKey)) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      if (tx.type === "income") {
        monthIncome += amount;
      } else {
        monthExpense += amount;
      }
    });

    calendarObligations.forEach((obligation) => {
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
    const netIncome = formatCurrencyParts(monthIncome, account.currencySymbol).full;
    const netExpense = formatCurrencyParts(monthExpense, account.currencySymbol).full;
    const net = formatCurrencyParts(monthIncome - monthExpense, account.currencySymbol).full;

    return {
      days,
      period: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      netIncome,
      netExpense,
      net,
    };
  }, [allTransactions, calendarObligations, monthReference, today, locale, account.currencySymbol]);

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
        categoryIconId: tx.category?.icon_id ?? null,
        badge: null,
        createdBy: resolveMovementCreator(tx.created_by),
      });
    });

    calendarObligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      if (toDateKey(obligation.due_date) !== selectedDayKey) return;
      movements.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        type: "expense",
        category: t("mobile.home.programmedBadge"),
        categoryIconId: null,
        badge: t("mobile.home.programmedBadge"),
      });
    });

    return {
      dateKey: selectedDayKey,
      formattedLabel: formatFullDate(dayDate, locale),
      movements,
    };
  }, [
    selectedDayKey,
    allTransactions,
    calendarObligations,
    locale,
    t,
    resolveMovementCreator,
  ]);

  const contextMovements = useMemo(() => {
    const items: Array<ContextMovement & { dateKey: string; sortKey: string }> = [];

    allTransactions.forEach((tx) => {
      const dateKey = toDateKey(tx.date);
      if (!dateKey) return;
      items.push({
        id: tx.id,
        name: tx.merchant ?? tx.category?.name ?? t("mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        type: tx.type,
        dateLabel: formatShortDate(dateKey, locale),
        category: tx.category?.name ?? null,
        categoryIconId: tx.category?.icon_id ?? null,
        badge: null,
        createdBy: resolveMovementCreator(tx.created_by),
        dateKey,
        sortKey: tx.created_at ?? "",
      });
    });

    calendarObligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      const dateKey = toDateKey(obligation.due_date);
      if (!dateKey) return;
      items.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        type: "expense",
        dateLabel: formatShortDate(dateKey, locale),
        category: t("mobile.home.programmedBadge"),
        categoryIconId: null,
        badge: t("mobile.home.programmedBadge"),
        dateKey,
        sortKey: "",
      });
    });

    return items;
  }, [allTransactions, calendarObligations, locale, t, resolveMovementCreator]);

  const selectedReferenceDayKey = selectedDayKey ?? todayKey;

  const contextUpcomingMovements = useMemo(() => {
    return contextMovements
      .filter((movement) => movement.dateKey > selectedReferenceDayKey)
      .sort((left, right) => {
        if (left.dateKey !== right.dateKey) return left.dateKey > right.dateKey ? 1 : -1;
        if (left.sortKey === right.sortKey) return 0;
        return left.sortKey > right.sortKey ? 1 : -1;
      })
      .slice(0, 3)
      .map(({ dateKey: _dateKey, sortKey: _sortKey, ...movement }) => movement);
  }, [contextMovements, selectedReferenceDayKey]);

  const contextPastMovements = useMemo(() => {
    return contextMovements
      .filter((movement) => movement.dateKey < selectedReferenceDayKey)
      .sort((left, right) => {
        if (left.dateKey !== right.dateKey) return left.dateKey > right.dateKey ? -1 : 1;
        if (left.sortKey === right.sortKey) return 0;
        return left.sortKey > right.sortKey ? -1 : 1;
      })
      .slice(0, 3)
      .map(({ dateKey: _dateKey, sortKey: _sortKey, ...movement }) => movement);
  }, [contextMovements, selectedReferenceDayKey]);

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
    <PageContainer className="pt-8 pb-20">
      <div className="grid grid-cols-3 items-stretch gap-3 sm:gap-6">
        <div className="col-span-1 min-h-full">
          <button
            type="button"
            onClick={() => router.push("/transactions")}
            className="h-full w-full text-left"
          >
            <BalanceHeader
              amountMinor={selectedMonthBalanceMinor}
              monthLabel={account.currentMonth}
              currencySymbol={account.currencySymbol}
              locale={locale}
              monoClassName={monoClassName}
            />
          </button>
        </div>

        <div className="col-span-2">
          <SavingsMonthCard
            title={t("home.savings.title")}
            monthLabel={account.currentMonth}
            message={savingsMessage}
            baseCurrency={account.baseCurrency}
            currencySymbol={account.currencySymbol}
            objectiveMinor={savingsDistribution.objectiveMinor}
            savingsMinor={savingsDistribution.savingsMinor}
            projectsMinor={savingsDistribution.projectCoveredMinor}
            huchaMinor={savingsDistribution.huchaMinor}
            onPress={() => router.push("/savings")}
            projectsLabel={t("home.savings.projects")}
            huchaLabel={t("home.savings.hucha")}
            totalLabel={t("home.savings.total")}
            monoClassName={monoClassName}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6">
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
          upcomingMovements={contextUpcomingMovements}
          pastMovements={contextPastMovements}
          onViewAllMovements={() => router.push("/transactions")}
          onCreateMovement={() => {
            openAddActionRef.current?.();
          }}
          locale={locale}
          monoClassName={monoClassName}
        />
      </div>
      <AddActionTrigger
        canEdit={account.canEdit}
        accountId={account.id}
        currency={account.baseCurrency}
        locale={locale}
        variant="hidden"
        registerExternalOpen={(open) => {
          openAddActionRef.current = open;
        }}
      />
    </PageContainer>
  );
}
