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
  computeMonthlySummary,
  getMonthRange,
  getEventsForMonth,
  getFlowForRange,
  getUpcomingItems,
  getRecentActivity,
  type AccountGlobalState,
  type CashflowItem,
  type CalendarEvent,
  type DateRange,
  type MonthlySummary,
  type RecentActivityItem,
  type UpcomingItem,
} from "./home.compute";

export type HomeViewModel = {
  account: Account;
  monthKey: string;
  accountSummary: AccountGlobalState;
  monthlyHero: {
    committedMinor: bigint;
    pendingMinor: bigint;
    paidMinor: bigint;
    paidLabel: string;
    nextObligation: UpcomingItem | null;
    hasObligations: boolean;
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
    incomeLabel: string;
    expenseLabel: string;
    committedLabel: string;
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
  month?: Date;
  nextDays?: number;
  recentLimit?: number;
  now?: Date;
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
  month,
  nextDays = 7,
  recentLimit = 6,
  now,
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
  const monthlySummary: MonthlySummary = computeMonthlySummary(
    obligations,
    monthlyTransactions,
    monthRange
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
  const nextObligation =
    getUpcomingItems(obligations, { start: startOfToday, end: monthRange.end })[0] ??
    null;

  const recentItems = getRecentActivity(
    recentTransactions ?? monthlyTransactions,
    recentLimit,
    account.base_currency,
    t(dictionary, "home.recentFallbackTitle")
  );

  const hasObligations = monthlySummary.obligationsCount > 0;
  const hasActivity = monthlySummary.activityCount > 0;
  const isGuestReadOnly = role === "viewer";

  const paidLabel = hasObligations
    ? t(dictionary, "home.paidLabel")
    : t(dictionary, "home.registeredLabel");
  const paidMinor = hasObligations
    ? monthlySummary.paidMinor
    : monthlySummary.registeredMinor;

  return {
    account,
    monthKey: toMonthKey(activeMonth),
    accountSummary,
    monthlyHero: {
      committedMinor: monthlySummary.committedMinor,
      pendingMinor: hasObligations ? monthlySummary.pendingMinor : 0n,
      paidMinor,
      paidLabel,
      nextObligation,
      hasObligations,
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
        t(dictionary, "home.recentFallbackTitle")
      ),
      highlightRange: upcomingRange,
    },
    recentActivity: {
      items: recentItems,
    },
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
      incomeLabel: t(dictionary, "common.incomeLabel"),
      expenseLabel: t(dictionary, "common.expenseLabel"),
      committedLabel: t(dictionary, "home.committedLabel"),
      pendingLabel: t(dictionary, "home.pendingLabel"),
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
    },
  };
}
