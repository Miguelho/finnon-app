import type {
  Account,
  Obligation,
  Participant,
  Transaction,
  UserRole,
} from "../domain/types";
import { homeCopy } from "../copy/home";
import {
  computeMonthlySummary,
  getMonthRange,
  getUpcomingItems,
  getRecentActivity,
  type DateRange,
  type MonthlySummary,
  type RecentActivityItem,
  type UpcomingItem,
} from "./home.compute";

export type HomeViewModel = {
  account: Account;
  monthKey: string;
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
    committedLabel: string;
    pendingLabel: string;
  };
};

export type BuildHomeViewModelInput = {
  account: Account;
  role: UserRole;
  participants?: Participant[];
  obligations?: Obligation[];
  monthlyTransactions?: Transaction[];
  recentTransactions?: Transaction[];
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
  obligations = [],
  monthlyTransactions = [],
  recentTransactions,
  month,
  nextDays = 7,
  recentLimit = 6,
  now,
}: BuildHomeViewModelInput): HomeViewModel {
  const today = now ?? new Date();
  const activeMonth = month ?? today;
  const monthRange = getMonthRange(activeMonth);
  const upcomingRange: DateRange = {
    start: today,
    end: addDays(today, nextDays),
  };

  const monthlySummary: MonthlySummary = computeMonthlySummary(
    obligations,
    monthlyTransactions,
    monthRange
  );

  const upcomingItems = getUpcomingItems(obligations, upcomingRange);
  const nextObligation =
    getUpcomingItems(obligations, { start: today, end: monthRange.end })[0] ??
    null;

  const recentItems = getRecentActivity(
    recentTransactions ?? monthlyTransactions,
    recentLimit,
    account.base_currency
  );

  const hasObligations = monthlySummary.obligationsCount > 0;
  const hasActivity = monthlySummary.activityCount > 0;
  const isGuestReadOnly = role === "viewer";

  const paidLabel = hasObligations ? homeCopy.paidLabel : homeCopy.registeredLabel;
  const paidMinor = hasObligations
    ? monthlySummary.paidMinor
    : monthlySummary.registeredMinor;

  return {
    account,
    monthKey: toMonthKey(activeMonth),
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
    recentActivity: {
      items: recentItems,
    },
    emptyStates: {
      obligations: {
        title: homeCopy.emptyObligationsTitle,
        cta: homeCopy.emptyObligationsCta,
      },
      activity: {
        title: homeCopy.emptyActivityTitle,
        cta: homeCopy.emptyActivityCta,
      },
      upcoming: homeCopy.upcomingEmpty,
      recent: homeCopy.recentEmpty,
    },
    permissions: {
      isGuestReadOnly,
      canEdit: !isGuestReadOnly,
    },
    copy: {
      guestBadge: homeCopy.guestBadge,
      guestBlurb: homeCopy.guestBlurb,
      guestCta: homeCopy.guestCta,
      addCta: homeCopy.addCta,
      upcomingCta: homeCopy.upcomingCta,
      recentCta: homeCopy.recentCta,
      committedLabel: homeCopy.committedLabel,
      pendingLabel: homeCopy.pendingLabel,
    },
  };
}
