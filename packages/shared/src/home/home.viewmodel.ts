import type {
  Account,
  Obligation,
  Participant,
  Transaction,
  UserRole,
} from "../domain/types";
import type { CopyDictionary } from "../copy";
import { t } from "../copy";
import {
  getAccountGlobalState,
  computeRealPendingSummary,
  computeScheduledExpenseMinor,
  getMonthRange,
  getEventsForMonth,
  getFlowForRange,
  getUpcomingItems,
  getRecentActivity,
  getWeekStrip,
  getUpcomingTopEvents,
  type AccountGlobalState,
  type CashflowItem,
  type CalendarEvent,
  type DateRange,
  type RecentActivityItem,
  type UpcomingItem,
  type WeekStripData,
  type UpcomingEvent,
} from "./home.compute";

export type HomeViewModel = {
  account: Account;
  monthKey: string;
  accountSummary: AccountGlobalState;
  monthOverview: {
    incomeRealMinor: bigint;
    incomePendingMinor: bigint;
    expenseRealMinor: bigint;
    expensePendingMinor: bigint;
    balanceTodayMinor: bigint;
    balanceEomMinor: bigint;
    hasActivity: boolean;
  };
  upcoming: {
    items: UpcomingItem[];
    range: DateRange;
  };
  cashflow: {
    incomeMinor: bigint;
    expenseMinor: bigint;
    items: CashflowItem[];
    range: DateRange;
  };
  calendar: {
    monthRange: DateRange;
    events: CalendarEvent[];
    highlightRange: DateRange;
  };
  recentActivity: {
    items: RecentActivityItem[];
  };
  weekStrip: WeekStripData;
  upcomingEvents: UpcomingEvent[];
  emptyStates: {
    obligations: {
      title: string;
      cta: string;
    };
    activity: {
      title: string;
      cta: string;
    };
    upcoming: string;
    recent: string;
  };
  permissions: {
    isGuestReadOnly: boolean;
    canEdit: boolean;
  };
  copy: {
    guestBadge: string;
    guestBlurb: string;
    guestCta: string;
    addCta: string;
    upcomingCta: string;
    recentCta: string;
    recentActivityTitle: string;
    balanceLabel: string;
    balanceTodayLabel: string;
    balanceEomLabel: string;
    incomeLabel: string;
    expenseLabel: string;
    realLabel: string;
    pendingLabel: string;
    upcomingObligationsTitle: string;
    cashflowTitle: string;
    markPaid: string;
    markPending: string;
    daySummaryTitle: string;
    dayObligationsTitle: string;
    dayRecurringTitle: string;
    dayTransactionsTitle: string;
    dayEmpty: string;
    monthEmpty: string;
    weekTitle: string;
    viewMonthCta: string;
    upcomingTitle: string;
    monthSummaryTitle: string;
    addForDayCta: string;
    dotsLegend: string;
    includesPending: string;
  };
};

export type BuildHomeViewModelInput = {
  account: Account;
  role: UserRole;
  dictionary: CopyDictionary;
  participants?: Participant[];
  obligations?: Obligation[];
  monthlyTransactions?: Transaction[];
  upcomingTransactions?: Transaction[];
  recentTransactions?: Transaction[];
  balanceTransactions?: Transaction[];
  weekTransactions?: Transaction[];
  weekObligations?: Obligation[];
  month?: Date;
  nextDays?: number;
  recentLimit?: number;
  upcomingEventsLimit?: number;
  locale?: string;
  now?: Date;
  weekReference?: Date;
  /** Optional expanded date range for calendar events (to show adjacent month days) */
  calendarEventRange?: { start: Date; end: Date };
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export function buildHomeViewModel({
  account,
  role,
  dictionary,
  obligations = [],
  monthlyTransactions = [],
  upcomingTransactions,
  recentTransactions,
  balanceTransactions,
  weekTransactions,
  weekObligations,
  month,
  nextDays = 7,
  recentLimit = 6,
  upcomingEventsLimit = 3,
  locale = "es",
  now,
  weekReference,
  calendarEventRange,
}: BuildHomeViewModelInput): HomeViewModel {
  const nowDate = now ?? new Date();
  const activeMonth = month ?? nowDate;
  const monthRange = getMonthRange(activeMonth);
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  );
  const balanceSource = balanceTransactions ?? monthlyTransactions;
  const upcomingRange: DateRange = {
    start: startOfToday,
    end: addDays(startOfToday, nextDays),
  };

  const accountSummary = getAccountGlobalState(balanceSource);
  const monthOverview = computeRealPendingSummary(
    monthlyTransactions,
    monthRange,
    nowDate
  );
  const scheduledExpenseMinor = computeScheduledExpenseMinor(
    obligations,
    monthRange,
    nowDate
  );

  const upcomingItems = getUpcomingItems(obligations, upcomingRange);
  const cashflowTransactions = upcomingTransactions ?? [];
  const cashflowWindow = getFlowForRange(
    obligations,
    cashflowTransactions,
    nextDays,
    account.base_currency,
    t(dictionary, "home.recentFallbackTitle"),
    nowDate
  );
  const recentItems = getRecentActivity(
    recentTransactions ?? monthlyTransactions,
    recentLimit,
    account.base_currency,
    t(dictionary, "home.recentFallbackTitle")
  );

  // WeekStrip data
  const weekStripData = getWeekStrip(
    weekObligations ?? obligations,
    weekTransactions ?? monthlyTransactions,
    nowDate,
    weekReference
  );

  // Upcoming top events (2-3 next events with day labels)
  const upcomingEventsData = getUpcomingTopEvents(
    obligations,
    cashflowTransactions,
    nextDays,
    upcomingEventsLimit,
    account.base_currency,
    t(dictionary, "home.recentFallbackTitle"),
    locale,
    nowDate
  );

  const hasActivity = monthlyTransactions.length > 0;
  const isGuestReadOnly = role === "viewer";

  return {
    account,
    monthKey: toMonthKey(activeMonth),
    accountSummary,
    monthOverview: {
      ...monthOverview,
      expensePendingMinor: monthOverview.expensePendingMinor + scheduledExpenseMinor,
      hasActivity,
    },
    upcoming: {
      items: upcomingItems,
      range: upcomingRange,
    },
    cashflow: {
      incomeMinor: cashflowWindow.incomeMinor,
      expenseMinor: cashflowWindow.expenseMinor,
      items: cashflowWindow.items,
      range: upcomingRange,
    },
    calendar: {
      monthRange,
      events: getEventsForMonth(
        activeMonth,
        obligations,
        monthlyTransactions,
        account.base_currency,
        t(dictionary, "home.recentFallbackTitle"),
        calendarEventRange
      ),
      highlightRange: upcomingRange,
    },
    recentActivity: {
      items: recentItems,
    },
    weekStrip: weekStripData,
    upcomingEvents: upcomingEventsData,
    emptyStates: {
      obligations: {
        title: t(dictionary, "home.emptyObligationsTitle"),
        cta: t(dictionary, "home.emptyObligationsCta"),
      },
      activity: {
        title: t(dictionary, "home.emptyActivityTitle"),
        cta: t(dictionary, "home.emptyActivityCta"),
      },
      upcoming: t(dictionary, "home.upcomingEmpty", { days: nextDays }),
      recent: t(dictionary, "home.recentEmpty"),
    },
    permissions: {
      isGuestReadOnly,
      canEdit: !isGuestReadOnly,
    },
    copy: {
      guestBadge: t(dictionary, "home.guestBadge"),
      guestBlurb: t(dictionary, "home.guestBlurb"),
      guestCta: t(dictionary, "home.guestCta"),
      addCta: t(dictionary, "home.addCta"),
      upcomingCta: t(dictionary, "home.upcomingCta"),
      recentCta: t(dictionary, "home.recentCta"),
      recentActivityTitle: t(dictionary, "home.recentActivityTitle"),
      balanceLabel: t(dictionary, "common.balanceLabel"),
      balanceTodayLabel: t(dictionary, "home.balanceTodayLabel"),
      balanceEomLabel: t(dictionary, "home.balanceEomLabel"),
      incomeLabel: t(dictionary, "common.incomeLabel"),
      expenseLabel: t(dictionary, "common.expenseLabel"),
      realLabel: t(dictionary, "common.realLabel"),
      pendingLabel: t(dictionary, "common.pendingLabel"),
      upcomingObligationsTitle: t(dictionary, "home.upcomingObligationsTitle"),
      cashflowTitle: t(dictionary, "home.cashflowTitle", { days: nextDays }),
      markPaid: t(dictionary, "home.markPaid"),
      markPending: t(dictionary, "home.markPending"),
      daySummaryTitle: t(dictionary, "home.daySummaryTitle"),
      dayObligationsTitle: t(dictionary, "home.dayObligationsTitle"),
      dayRecurringTitle: t(dictionary, "home.dayRecurringTitle"),
      dayTransactionsTitle: t(dictionary, "home.dayTransactionsTitle"),
      dayEmpty: t(dictionary, "home.dayEmpty"),
      monthEmpty: t(dictionary, "home.monthEmpty"),
      weekTitle: t(dictionary, "home.weekTitle"),
      viewMonthCta: t(dictionary, "home.viewMonthCta"),
      upcomingTitle: t(dictionary, "home.upcomingTitle"),
      monthSummaryTitle: t(dictionary, "home.monthSummaryTitle"),
      addForDayCta: t(dictionary, "home.addForDayCta"),
      dotsLegend: t(dictionary, "home.dotsLegend"),
      includesPending: t(dictionary, "home.includesPending"),
    },
  };
}
