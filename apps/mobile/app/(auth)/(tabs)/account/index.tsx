import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import {
  CURRENCIES,
  calculateContributionBalance,
  formatDateISO,
  getAvatarInitials,
  getMinorUnits,
  getPeriodEnd,
  getPeriodRange,
  toMonthKey,
  getUserAvatarColor,
  resolveAvatarColor,
  simplifyContributionDebts,
  themeTokens,
  USER_AVATAR_COLORS,
  type AccountSummaryData,
  type AvatarColorToken,
  type ContributionSplitDetail,
  type ContributionSplitType,
  type DateRange,
  type UserAvatarColorId,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { AccountScreen } from "../../../../src/components/account-redesign/components/account";
import type {
  AccountScreenData,
  CategorySummary,
  MonthlyDataPoint,
  Period,
  Transaction,
} from "../../../../src/components/account-redesign/types/account";
import { spacing, typography } from "../../../../src/components/account-redesign/theme/tokens";

const MONTH_LABELS: Record<string, string[]> = {
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const DAY_LABELS: Record<string, string[]> = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const addMonths = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const addDays = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const parseISODate = (value: string) => {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  return new Date(
    Number.isFinite(year) ? year : 1970,
    (Number.isFinite(month) ? month : 1) - 1,
    Number.isFinite(day) ? day : 1
  );
};

const parseMonthKey = (value: string) => {
  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  return {
    year: Number.isFinite(year) ? year : 1970,
    monthIndex: Math.max(0, (Number.isFinite(month) ? month : 1) - 1),
  };
};

const isWithinRange = (date: Date, range: { start: Date; end: Date }) =>
  date >= range.start && date <= range.end;

type TransactionCategoryRow = {
  id: string;
  name: string;
  icon_id: string | null;
  type?: "income" | "expense" | null;
};

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: number;
  amount_base_minor?: number | null;
  created_by?: string | null;
  paid_by?: string | null;
  split_type?: ContributionSplitType | null;
  split_details?:
    | Array<{ user_id?: string; userId?: string; share_minor?: number; shareMinor?: number }>
    | null;
  date: string;
  merchant: string | null;
  category: TransactionCategoryRow | TransactionCategoryRow[] | null;
};

type NormalizedTransactionRow = Omit<TransactionRow, "category"> & {
  category: TransactionCategoryRow | null;
};

type ProfileColorRow = {
  user_id: string;
  avatar_color?: UserAvatarColorId | null;
  avatar_fallback_bg_token?: AvatarColorToken | null;
};

const normalizeTransactionCategory = (
  category: TransactionRow["category"]
): TransactionCategoryRow | null => {
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }
  return category ?? null;
};

const getAmountMinor = (row: { amount_minor: number; amount_base_minor?: number | null }) => {
  const raw = row.amount_base_minor ?? row.amount_minor ?? 0;
  return Number(raw);
};

const normalizeHex = (value: string) => {
  const normalized = value.trim();
  const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const short = shortMatch[1] ?? "000";
    const r = short[0] ?? "0";
    const g = short[1] ?? "0";
    const b = short[2] ?? "0";
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const fullMatch = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (fullMatch) return `#${fullMatch[1]}`.toUpperCase();
  return "#2563EB";
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const adjustLightness = (hex: string, amount: number) => {
  const normalized = normalizeHex(hex);
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  const adjust = (channel: number) => clamp(Math.round(channel + amount * 255), 0, 255);
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(adjust(red))}${toHex(adjust(green))}${toHex(adjust(blue))}`;
};

const resolveUserColors = (memberIds: string[], baseColorByUser: Map<string, string>) => {
  const usedByBase = new Map<string, number>();
  const resolved = new Map<string, string>();

  memberIds.forEach((userId) => {
    const base = normalizeHex(baseColorByUser.get(userId) ?? "#2563EB");
    const index = usedByBase.get(base) ?? 0;
    usedByBase.set(base, index + 1);

    if (index === 0) {
      resolved.set(userId, base);
      return;
    }

    const step = Math.ceil(index / 2);
    const shift = 0.16 * step;
    const variant = index % 2 === 1 ? adjustLightness(base, shift) : adjustLightness(base, -shift);
    resolved.set(userId, variant);
  });

  return resolved;
};

const getParticipantDisplayName = (participant: AccountSummaryData["participants"][number]) =>
  participant.display_name?.trim() || participant.email?.trim() || participant.user_id.slice(0, 6);

const getShortName = (name: string) => {
  const firstToken = name.trim().split(/\s+/)[0] ?? "";
  return firstToken.length > 0 ? firstToken : name;
};

const getCustomSplitInBaseMinor = (
  row: NormalizedTransactionRow
): ContributionSplitDetail[] | null => {
  if (!Array.isArray(row.split_details) || row.split_details.length === 0) {
    return null;
  }

  const amountMinor = Number(row.amount_minor ?? 0);
  const amountBaseMinor = getAmountMinor(row);
  if (amountBaseMinor <= 0) return null;

  const rawDetails = row.split_details
    .map((split) => {
      const userId = (split.user_id ?? split.userId ?? "").trim();
      const shareMinorRaw = split.share_minor ?? split.shareMinor ?? 0;
      return {
        userId,
        shareMinor: Math.max(0, Math.trunc(Number(shareMinorRaw))),
      };
    })
    .filter((split) => split.userId.length > 0);

  if (rawDetails.length === 0) return null;
  if (amountMinor <= 0 || amountMinor === amountBaseMinor) {
    return rawDetails;
  }

  const ratio = amountBaseMinor / amountMinor;
  const converted = rawDetails.map((split) => ({
    userId: split.userId,
    shareMinor: Math.max(0, Math.trunc(split.shareMinor * ratio)),
  }));
  const totalConverted = converted.reduce((acc, split) => acc + split.shareMinor, 0);
  const diff = amountBaseMinor - totalConverted;
  const firstSplit = converted[0];
  if (firstSplit && diff !== 0) {
    converted[0] = {
      ...firstSplit,
      shareMinor: Math.max(0, firstSplit.shareMinor + diff),
    };
  }
  return converted;
};

const getMonthLabel = (date: Date, locale: string) => {
  const labels = (MONTH_LABELS[locale] ?? MONTH_LABELS.es ?? []) as string[];
  const firstLabel = labels[0] ?? "";
  return labels[date.getMonth()] ?? firstLabel;
};

const getCategoryColorKey = (name: string, iconId?: string | null) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("casa") || iconId === "House") return "casa";
  if (normalized.includes("famil") || iconId === "UsersThree") return "familia";
  if (
    normalized.includes("ocio") ||
    ["GameController", "FilmSlate", "MusicNotes", "Basketball", "Barbell"].includes(
      iconId ?? ""
    )
  ) {
    return "ocio";
  }
  if (normalized.includes("restaur") || iconId === "ForkKnife") return "restaurantes";
  if (
    normalized.includes("inter") ||
    ["PiggyBank", "Bank", "Wallet", "Receipt", "CreditCard"].includes(iconId ?? "")
  ) {
    return "interests";
  }
  if (normalized.includes("loter") || iconId === "Ticket") return "lottery";
  return "default";
};

type Bucket = { label: string; start: Date; end: Date; isCurrent: boolean };

const getDaySpan = (range: DateRange) => {
  const start = startOfDay(range.start);
  const end = startOfDay(range.end);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const getPreviousPeriodRange = (period: Period, currentRange: DateRange): DateRange => {
  const span = getDaySpan(currentRange);

  switch (period) {
    case "week": {
      const end = endOfDay(addDays(currentRange.start, -1));
      const start = startOfDay(addDays(end, -(span - 1)));
      return { start, end };
    }
    case "month": {
      const prevStart = new Date(
        currentRange.start.getFullYear(),
        currentRange.start.getMonth() - 1,
        1
      );
      const prevEndLimit = endOfDay(endOfMonth(prevStart));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
    case "quarter": {
      const prevStart = addMonths(currentRange.start, -3);
      const prevEndLimit = endOfDay(new Date(prevStart.getFullYear(), prevStart.getMonth() + 3, 0));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
    case "year":
    default: {
      const prevStart = new Date(currentRange.start.getFullYear() - 1, 0, 1);
      const prevEndLimit = endOfDay(new Date(prevStart.getFullYear(), 12, 0));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
  }
};

const resolveCurrentRange = (
  period: Period,
  referenceDate: Date,
  selectedMonth?: string
): DateRange => {
  if (period === "month" && selectedMonth) {
    const { year, monthIndex } = parseMonthKey(selectedMonth);
    const start = new Date(year, monthIndex, 1);
    return { start, end: endOfDay(endOfMonth(start)) };
  }

  return {
    start: getPeriodRange(period, referenceDate).start,
    end: getPeriodEnd(period, referenceDate),
  };
};

const buildBuckets = (period: Period, range: DateRange, locale: string, now: Date): Bucket[] => {
  const buckets: Bucket[] = [];
  const current = now;

  if (period === "week") {
    const labels = (DAY_LABELS[locale] ?? DAY_LABELS.es ?? []) as string[];
    const firstLabel = labels[0] ?? "";
    const span = getDaySpan(range);
    for (let i = 0; i < span; i += 1) {
      const day = addDays(range.start, i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      buckets.push({
        label: labels[day.getDay()] ?? firstLabel,
        start,
        end,
        isCurrent: isWithinRange(current, { start, end }),
      });
    }
    return buckets;
  }

  if (period === "month") {
    let cursor = startOfDay(range.start);
    let index = 0;
    while (cursor <= range.end) {
      const start = cursor;
      let end = endOfDay(addDays(cursor, 6));
      if (end > range.end) end = range.end;
      buckets.push({
        label: `S${index + 1}`,
        start,
        end,
        isCurrent: isWithinRange(current, { start, end }),
      });
      cursor = addDays(start, 7);
      index += 1;
    }
    return buckets;
  }

  let cursor = startOfMonth(range.start);
  while (cursor <= range.end) {
    const start = cursor;
    let end = endOfDay(endOfMonth(cursor));
    if (end > range.end) end = range.end;
    buckets.push({
      label: getMonthLabel(cursor, locale),
      start,
      end,
      isCurrent: isWithinRange(current, { start, end }),
    });
    cursor = addMonths(cursor, 1);
  }

  return buckets;
};

const sumTotals = (rows: NormalizedTransactionRow[]) => {
  let income = 0;
  let expense = 0;
  rows.forEach((tx) => {
    const amountMinor = getAmountMinor(tx);
    if (tx.type === "income") income += amountMinor;
    else expense += amountMinor;
  });
  return { income, expense };
};

function buildAccountScreenData(params: {
  summary: AccountSummaryData;
  transactions: NormalizedTransactionRow[];
  period: Period;
  selectedMonth?: string;
  locale: string;
  accountLabel: string;
  uncategorizedLabel: string;
  profileColorsByUserId: Map<string, ProfileColorRow>;
}): { data: AccountScreenData; currencyDecimals: number } {
  const {
    summary,
    transactions,
    period,
    selectedMonth,
    locale,
    accountLabel,
    uncategorizedLabel,
    profileColorsByUserId,
  } = params;

  const currencyCode = summary.account.base_currency;
  const minorUnits = getMinorUnits(currencyCode);
  const divisor = Math.pow(10, minorUnits);

  const activeParticipants = summary.participants.filter(
    (participant) => participant.role === "admin" || participant.role === "contributor"
  );
  const activeMemberIds = activeParticipants.map((participant) => participant.user_id);
  const participantByUserId = new Map(
    summary.participants.map((participant) => [participant.user_id, participant])
  );

  const baseColorByUserId = new Map<string, string>();
  activeParticipants.forEach((participant) => {
    const profileColor = profileColorsByUserId.get(participant.user_id);
    if (profileColor?.avatar_color) {
      const colorId = getUserAvatarColor(profileColor.avatar_color);
      baseColorByUserId.set(participant.user_id, USER_AVATAR_COLORS[colorId].fg);
      return;
    }

    const fallbackToken =
      profileColor?.avatar_fallback_bg_token ??
      (participant.avatar_fallback_bg_token as AvatarColorToken | null) ??
      "action.secondary";

    baseColorByUserId.set(
      participant.user_id,
      resolveAvatarColor(themeTokens.light, fallbackToken as AvatarColorToken)
    );
  });

  const resolvedColorByUserId = resolveUserColors(activeMemberIds, baseColorByUserId);

  const contributors = activeParticipants.map((participant) => {
    const name = getParticipantDisplayName(participant);
    return {
      userId: participant.user_id,
      name,
      shortName: getShortName(name),
      initials: getAvatarInitials(participant.email, participant.display_name),
      color: resolvedColorByUserId.get(participant.user_id) ?? "#2563EB",
    };
  });

  const contributorByUserId = new Map(contributors.map((contributor) => [contributor.userId, contributor]));

  const now = new Date();
  const currentRange = resolveCurrentRange(period, now, selectedMonth);
  const previousRange = getPreviousPeriodRange(period, currentRange);

  const currentTransactions = transactions.filter((tx) =>
    isWithinRange(parseISODate(tx.date), currentRange)
  );
  const previousTransactions = transactions.filter((tx) =>
    isWithinRange(parseISODate(tx.date), previousRange)
  );

  const currentTotals = sumTotals(currentTransactions);
  const previousTotals = sumTotals(previousTransactions);

  const incomeDelta =
    previousTotals.income > 0
      ? ((currentTotals.income - previousTotals.income) / previousTotals.income) * 100
      : null;
  const expenseDelta =
    previousTotals.expense > 0
      ? ((currentTotals.expense - previousTotals.expense) / previousTotals.expense) * 100
      : null;

  const flowIncomeByUserMinor = new Map<string, number>();
  const flowExpenseByUserMinor = new Map<string, number>();
  activeMemberIds.forEach((userId) => {
    flowIncomeByUserMinor.set(userId, 0);
    flowExpenseByUserMinor.set(userId, 0);
  });

  currentTransactions.forEach((tx) => {
    const payerId = tx.paid_by ?? tx.created_by ?? "";
    const amountMinor = getAmountMinor(tx);
    if (tx.type === "income") {
      if (flowIncomeByUserMinor.has(payerId)) {
        flowIncomeByUserMinor.set(payerId, (flowIncomeByUserMinor.get(payerId) ?? 0) + amountMinor);
      }
      return;
    }

    if (flowExpenseByUserMinor.has(payerId)) {
      flowExpenseByUserMinor.set(payerId, (flowExpenseByUserMinor.get(payerId) ?? 0) + amountMinor);
    }
  });

  const buckets = buildBuckets(period, currentRange, locale, now);
  const monthlyHistory: MonthlyDataPoint[] = buckets.map((bucket) => {
    const bucketTransactions = currentTransactions.filter((tx) =>
      isWithinRange(parseISODate(tx.date), { start: bucket.start, end: bucket.end })
    );
    const bucketTotals = sumTotals(bucketTransactions);

    const incomeByUserMinor = new Map<string, number>();
    const expenseByUserMinor = new Map<string, number>();
    activeMemberIds.forEach((userId) => {
      incomeByUserMinor.set(userId, 0);
      expenseByUserMinor.set(userId, 0);
    });

    bucketTransactions.forEach((tx) => {
      const payerId = tx.paid_by ?? tx.created_by ?? "";
      const amountMinor = getAmountMinor(tx);
      if (tx.type === "income") {
        if (incomeByUserMinor.has(payerId)) {
          incomeByUserMinor.set(payerId, (incomeByUserMinor.get(payerId) ?? 0) + amountMinor);
        }
        return;
      }
      if (expenseByUserMinor.has(payerId)) {
        expenseByUserMinor.set(payerId, (expenseByUserMinor.get(payerId) ?? 0) + amountMinor);
      }
    });

    return {
      label: bucket.label,
      income: bucketTotals.income / divisor,
      expense: bucketTotals.expense / divisor,
      isCurrent: bucket.isCurrent,
      incomeByUser: activeMemberIds.map((userId) => ({
        userId,
        amount: (incomeByUserMinor.get(userId) ?? 0) / divisor,
      })),
      expenseByUser: activeMemberIds.map((userId) => ({
        userId,
        amount: (expenseByUserMinor.get(userId) ?? 0) / divisor,
      })),
    };
  });

  const buildContributionCategories = (type: "income" | "expense") => {
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        iconId: string | null;
        totalMinor: number;
        transactionCount: number;
        byUserMinor: Map<string, number>;
      }
    >();

    currentTransactions.forEach((tx) => {
      if (tx.type !== type) return;
      const amountMinor = getAmountMinor(tx);
      if (amountMinor <= 0) return;
      const payerId = tx.paid_by ?? tx.created_by ?? "";
      if (activeMemberIds.length > 0 && !activeMemberIds.includes(payerId)) return;

      const categoryId = tx.category?.id ?? "uncategorized";
      const categoryName = tx.category?.name ?? uncategorizedLabel;
      const existing = categoryMap.get(categoryId);

      if (existing) {
        existing.totalMinor += amountMinor;
        existing.transactionCount += 1;
        existing.byUserMinor.set(payerId, (existing.byUserMinor.get(payerId) ?? 0) + amountMinor);
        return;
      }

      const byUserMinor = new Map<string, number>();
      byUserMinor.set(payerId, amountMinor);
      categoryMap.set(categoryId, {
        id: categoryId,
        name: categoryName,
        iconId: tx.category?.icon_id ?? null,
        totalMinor: amountMinor,
        transactionCount: 1,
        byUserMinor,
      });
    });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.totalMinor - a.totalMinor)
      .map((category) => ({
        id: category.id,
        name: category.name,
        iconId: category.iconId,
        totalAmount: category.totalMinor / divisor,
        transactionCount: category.transactionCount,
        shares: contributors.map((contributor) => {
          const shareMinor = category.byUserMinor.get(contributor.userId) ?? 0;
          return {
            userId: contributor.userId,
            name: contributor.name,
            amount: shareMinor / divisor,
            percentage: category.totalMinor > 0 ? (shareMinor / category.totalMinor) * 100 : 0,
          };
        }),
      }));
  };

  const expenseContributionCategories = buildContributionCategories("expense");
  const incomeContributionCategories = buildContributionCategories("income");

  const categories: CategorySummary[] = expenseContributionCategories.map((category) => ({
    id: category.id,
    name: category.name,
    iconId: category.iconId,
    colorKey: getCategoryColorKey(category.name, category.iconId),
    amount: category.totalAmount,
    transactionCount: category.transactionCount,
    type: "expense",
  }));

  const recent: Transaction[] = [...currentTransactions]
    .sort((a, b) => parseISODate(b.date).getTime() - parseISODate(a.date).getTime())
    .slice(0, 4)
    .map((tx) => {
      const amountMinor = getAmountMinor(tx);
      const isIncome = tx.type === "income";
      const categoryName = tx.category?.name ?? uncategorizedLabel;
      return {
        id: tx.id,
        description: tx.merchant ?? categoryName,
        categoryName,
        categoryIconId: tx.category?.icon_id ?? null,
        amount: (amountMinor / divisor) * (isIncome ? 1 : -1),
        date: tx.date,
      };
    });

  let memberBalance: AccountScreenData["memberBalance"] = {
    members: [],
    debts: [],
    expenseCategories: expenseContributionCategories,
    incomeCategories: incomeContributionCategories,
  };

  if (activeParticipants.length >= 2) {
    const expenseTransactions = currentTransactions.filter((tx) => tx.type === "expense");
    const contributionTransactions = expenseTransactions.map((tx) => ({
      id: tx.id,
      amountBaseMinor: getAmountMinor(tx),
      paidByUserId: tx.paid_by ?? tx.created_by ?? "",
      splitType: (tx.split_type ?? "equal") as ContributionSplitType,
      splitDetails: tx.split_type === "custom" ? getCustomSplitInBaseMinor(tx) : undefined,
    }));

    const memberBalances = calculateContributionBalance(contributionTransactions, activeMemberIds);
    const memberDebts = simplifyContributionDebts(memberBalances, divisor);

    memberBalance = {
      members: memberBalances.map((member) => {
        const contributor = contributorByUserId.get(member.userId);
        const participant = participantByUserId.get(member.userId);
        return {
          userId: member.userId,
          name: contributor?.name ?? member.userId.slice(0, 6),
          initials:
            contributor?.initials ?? getAvatarInitials(participant?.email ?? null, participant?.display_name),
          color: contributor?.color ?? "#2563EB",
          totalPaid: member.totalPaidMinor / divisor,
          totalResponsible: member.totalResponsibleMinor / divisor,
          net: member.netMinor / divisor,
        };
      }),
      debts: memberDebts.map((debt) => ({
        fromUserId: debt.fromUserId,
        fromName: contributorByUserId.get(debt.fromUserId)?.name ?? debt.fromUserId.slice(0, 6),
        toUserId: debt.toUserId,
        toName: contributorByUserId.get(debt.toUserId)?.name ?? debt.toUserId.slice(0, 6),
        amount: debt.amountMinor / divisor,
      })),
      expenseCategories: expenseContributionCategories,
      incomeCategories: incomeContributionCategories,
    };
  }

  const accountIcon = summary.account.name.slice(0, 1).toUpperCase();

  return {
    data: {
      account: {
        id: summary.account.id,
        name: summary.account.name,
        icon: accountIcon,
        type: accountLabel,
        currency: summary.account.base_currency,
        balance: summary.totals.balance_total / divisor,
      },
      flow: {
        totalIncome: currentTotals.income / divisor,
        totalExpense: currentTotals.expense / divisor,
        incomeDelta,
        expenseDelta,
        byUser: {
          income: activeMemberIds.map((userId) => ({
            userId,
            amount: (flowIncomeByUserMinor.get(userId) ?? 0) / divisor,
          })),
          expense: activeMemberIds.map((userId) => ({
            userId,
            amount: (flowExpenseByUserMinor.get(userId) ?? 0) / divisor,
          })),
        },
      },
      categories,
      recentTransactions: recent,
      monthlyHistory,
      contributors,
      memberBalance,
    },
    currencyDecimals: minorUnits,
  };
}

export default function AccountTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, selectedAccountId, isInitialized } = useAuth();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const { reportNetworkIssue } = useNetworkNotice();
  const { dictionary, locale } = useCopy();

  const [period, setPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(new Date()));
  const [summaryData, setSummaryData] = useState<AccountSummaryData | null>(null);
  const [transactions, setTransactions] = useState<NormalizedTransactionRow[]>([]);
  const [profileColorRows, setProfileColorRows] = useState<ProfileColorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computed = useMemo(() => {
    if (!summaryData) return null;

    const profileColorsByUserId = new Map(
      profileColorRows.map((profile) => [profile.user_id, profile])
    );

    return buildAccountScreenData({
      summary: summaryData,
      transactions,
      period,
      selectedMonth,
      locale,
      accountLabel: t(dictionary, "account.labelAccount"),
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      profileColorsByUserId,
    });
  }, [summaryData, transactions, period, selectedMonth, locale, dictionary, profileColorRows]);

  const screenData = computed?.data ?? null;
  const currencyDecimals = computed?.currencyDecimals ?? 2;

  const currencySymbol = useMemo(() => {
    const code = summaryData?.account.base_currency ?? "";
    return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code;
  }, [summaryData?.account.base_currency]);

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !user) return;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_account_summary",
        { p_account_id: selectedAccountId }
      );

      if (rpcError) throw rpcError;
      if (!rpcData) throw new Error(t(dictionary, "account.loadError"));

      const participantIds = (rpcData as AccountSummaryData).participants.map(
        (participant) => participant.user_id
      );

      let profileRows: ProfileColorRow[] = [];
      if (participantIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, avatar_color, avatar_fallback_bg_token")
          .in("user_id", participantIds);

        if (profilesError) {
          console.error("[AccountTabScreen] Profiles query error:", profilesError);
        } else {
          profileRows = (profilesData ?? []) as ProfileColorRow[];
        }
      }

      const now = new Date();
      const queryStart = new Date(now.getFullYear() - 1, 0, 1);
      const startDate = formatDateISO(queryStart);
      const endDate = formatDateISO(getPeriodEnd("year", now));

      const { data: rows, error: rowsError } = await supabase
        .from("transactions")
        .select(
          "id, type, amount_minor, amount_base_minor, created_by, paid_by, split_type, split_details, date, merchant, category:categories(id, name, icon_id, type)"
        )
        .eq("account_id", selectedAccountId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (rowsError) throw rowsError;

      const normalizedRows = ((rows ?? []) as TransactionRow[]).map((row) => ({
        ...row,
        category: normalizeTransactionCategory(row.category),
      }));

      setSummaryData(rpcData as AccountSummaryData);
      setProfileColorRows(profileRows);
      setTransactions(normalizedRows);
      setError(null);
    } catch (err: any) {
      console.error("[AccountTabScreen] Error:", err);
      setError(err?.message ?? t(dictionary, "account.loadError"));
      reportNetworkIssue({ onRetry: loadData });
    }
  }, [dictionary, reportNetworkIssue, selectedAccountId, user]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await loadData();
      if (!cancelled) setLoading(false);
    }

    if (isInitialized && selectedAccountId && isFocused) {
      init();
    }

    return () => {
      cancelled = true;
    };
  }, [isFocused, isInitialized, loadData, selectedAccountId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!isInitialized) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <ActivityIndicator size="large" color={primaryActionColor} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <ActivityIndicator size="large" color={primaryActionColor} />
      </View>
    );
  }

  if (error || !screenData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: userTokens.background }]}>
        <Text style={[styles.errorTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "account.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: userTokens.textSecondary }]}>
          {error ?? t(dictionary, "account.loadError")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: userTokens.background }]}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: userTokens.background }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing["6xl"] + insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryActionColor}
          />
        }
      >
        <AccountScreen
          data={screenData}
          period={period}
          selectedMonth={selectedMonth}
          onPeriodChange={setPeriod}
          onMonthChange={setSelectedMonth}
          currencySymbol={currencySymbol}
          currencyDecimals={currencyDecimals}
          onSettingsPress={() => router.push("/(auth)/settings/account/general")}
          onSearchPress={() => {
            const monthParam =
              period === "month" ? `&month=${encodeURIComponent(selectedMonth)}` : "";
            router.push(`/(auth)/(tabs)/transactions?period=${period}${monthParam}`);
          }}
          onContributionCategoryPress={(categoryId, type) => {
            const monthParam =
              period === "month" ? `&month=${encodeURIComponent(selectedMonth)}` : "";
            const categoryParam =
              categoryId !== "uncategorized"
                ? `&category=${encodeURIComponent(categoryId)}`
                : "";
            router.push(
              `/(auth)/(tabs)/transactions?period=${period}${monthParam}&type=${type}${categoryParam}`
            );
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing["2xl"],
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["4xl"],
  },
  errorTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.xl,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.md,
    textAlign: "center",
  },
});
