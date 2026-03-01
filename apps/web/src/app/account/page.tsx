import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import {
  AvatarColorToken,
  calculateContributionBalance,
  formatDateISO,
  getAvatarInitials,
  getUserAvatarColor,
  getDictionary,
  getMinorUnits,
  getPeriodEnd,
  getPeriodRange,
  getRecentMonthKeys,
  toMonthKey,
  resolveAvatarColor,
  simplifyContributionDebts,
  t,
  themeTokens,
  USER_AVATAR_COLORS,
  type AccountSummaryData,
  type ContributionSplitDetail,
  type ContributionSplitType,
  type DateRange,
  type UserAvatarColorId,
} from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { PageContainer } from "@/components/layout/page-container";
import { AccountRedesignClient } from "@/components/account/account-redesign-client";
import type {
  AccountRedesignData,
  AccountRedesignPeriod,
} from "@/components/account/account-redesign-types";
import { getCategoryColorKey } from "@/components/account/account-redesign-utils";
import { cn } from "@/lib/utils";
import { JSX } from "react";

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
  category: {
    id: string;
    name: string;
    icon_id: string | null;
    type?: "income" | "expense" | null;
  } | null;
};

type ProfileColorRow = {
  user_id: string;
  avatar_color?: UserAvatarColorId | null;
  avatar_fallback_bg_token?: AvatarColorToken | null;
};

const normalizeTransactionCategory = (
  category: TransactionRow["category"] | NonNullable<TransactionRow["category"]>[]
): TransactionRow["category"] => {
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }
  return category ?? null;
};

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

const getAmountMinor = (row: TransactionRow) => {
  const raw = row.amount_base_minor ?? row.amount_minor ?? 0;
  return Number(raw);
};

const normalizeHex = (value: string) => {
  const normalized = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;
  const shortMatch = normalized.match(short);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const fullMatch = normalized.match(full);
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

const resolveUserColors = (
  memberIds: string[],
  baseColorByUser: Map<string, string>
) => {
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
  participant.display_name?.trim() ||
  participant.email?.trim() ||
  participant.user_id.slice(0, 6);

const getShortName = (name: string) => {
  const firstToken = name.trim().split(/\s+/)[0] ?? "";
  return firstToken.length > 0 ? firstToken : name;
};

const getCustomSplitInBaseMinor = (row: TransactionRow): ContributionSplitDetail[] | null => {
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
  if (converted.length > 0 && diff !== 0) {
    converted[0] = {
      ...converted[0],
      shareMinor: Math.max(0, converted[0].shareMinor + diff),
    };
  }
  return converted;
};

type Bucket = { label: string; start: Date; end: Date; isCurrent: boolean };

const getDaySpan = (range: DateRange) => {
  const start = startOfDay(range.start);
  const end = startOfDay(range.end);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};


const getPreviousPeriodRange = (
  period: AccountRedesignPeriod,
  currentRange: DateRange
): DateRange => {
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
  period: AccountRedesignPeriod,
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

const buildBuckets = (
  period: AccountRedesignPeriod,
  range: DateRange,
  locale: string,
  now: Date
): Bucket[] => {
  const buckets: Bucket[] = [];
  if (period === "week") {
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const span = getDaySpan(range);
    for (let i = 0; i < span; i += 1) {
      const day = addDays(range.start, i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      buckets.push({
        label: weekdayFormatter.format(day).replace(".", ""),
        start,
        end,
        isCurrent: isWithinRange(now, { start, end }),
      });
    }
    return buckets;
  }

  if (period === "month") {
    let cursor = startOfDay(range.start);
    let index = 0;
    const weekPrefix = locale.startsWith("en") ? "W" : "S";
    while (cursor <= range.end) {
      const start = cursor;
      let end = endOfDay(addDays(cursor, 6));
      if (end > range.end) end = range.end;
      buckets.push({
        label: `${weekPrefix}${index + 1}`,
        start,
        end,
        isCurrent: isWithinRange(now, { start, end }),
      });
      cursor = addDays(start, 7);
      index += 1;
    }
    return buckets;
  }

  let cursor = startOfMonth(range.start);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  while (cursor <= range.end) {
    const start = cursor;
    let end = endOfDay(endOfMonth(cursor));
    if (end > range.end) end = range.end;
    buckets.push({
      label: monthFormatter.format(cursor).replace(".", ""),
      start,
      end,
      isCurrent: isWithinRange(now, { start, end }),
    });
    cursor = addMonths(cursor, 1);
  }

  return buckets;
};

const sumTotals = (rows: TransactionRow[]) => {
  let income = 0;
  let expense = 0;
  rows.forEach((tx) => {
    const amountMinor = getAmountMinor(tx);
    if (tx.type === "income") income += amountMinor;
    else expense += amountMinor;
  });
  return { income, expense };
};

type ContributionBalanceData = NonNullable<AccountRedesignData["contributionBalance"]>;

function buildAccountRedesignData(params: {
  summary: AccountSummaryData;
  transactions: TransactionRow[];
  period: AccountRedesignPeriod;
  now: Date;
  selectedMonth?: string;
  locale: string;
  uncategorizedLabel: string;
  accountLabel: string;
  profileColorsByUserId: Map<string, ProfileColorRow>;
}): AccountRedesignData {
  const {
    summary,
    transactions,
    period,
    now,
    selectedMonth,
    locale,
    uncategorizedLabel,
    accountLabel,
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
    if (!flowIncomeByUserMinor.has(payerId) && !flowExpenseByUserMinor.has(payerId)) return;
    const amountMinor = getAmountMinor(tx);
    if (tx.type === "income") {
      flowIncomeByUserMinor.set(payerId, (flowIncomeByUserMinor.get(payerId) ?? 0) + amountMinor);
      return;
    }
    flowExpenseByUserMinor.set(payerId, (flowExpenseByUserMinor.get(payerId) ?? 0) + amountMinor);
  });

  const buckets = buildBuckets(period, currentRange, locale, now);
  const monthlyHistory = buckets.map((bucket) => {
    const bucketTransactions = currentTransactions.filter((tx) =>
      isWithinRange(parseISODate(tx.date), { start: bucket.start, end: bucket.end })
    );
    const totals = sumTotals(bucketTransactions);
    const incomeByUserMinor = new Map<string, number>();
    const expenseByUserMinor = new Map<string, number>();
    activeMemberIds.forEach((userId) => {
      incomeByUserMinor.set(userId, 0);
      expenseByUserMinor.set(userId, 0);
    });
    bucketTransactions.forEach((tx) => {
      const payerId = tx.paid_by ?? tx.created_by ?? "";
      if (!incomeByUserMinor.has(payerId) && !expenseByUserMinor.has(payerId)) return;
      const amountMinor = getAmountMinor(tx);
      if (tx.type === "income") {
        incomeByUserMinor.set(payerId, (incomeByUserMinor.get(payerId) ?? 0) + amountMinor);
        return;
      }
      expenseByUserMinor.set(payerId, (expenseByUserMinor.get(payerId) ?? 0) + amountMinor);
    });
    return {
      label: bucket.label,
      income: totals.income / divisor,
      expense: totals.expense / divisor,
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

  const categories = expenseContributionCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    iconId: cat.iconId,
    colorKey: getCategoryColorKey(cat.name, cat.iconId),
    amount: cat.totalAmount,
    transactionCount: cat.transactionCount,
    type: "expense" as const,
  }));

  const recent = [...currentTransactions]
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

  const contributionBalanceBase: ContributionBalanceData = {
    members: [],
    debts: [],
    expenseCategories: expenseContributionCategories,
    incomeCategories: incomeContributionCategories,
  };

  let contributionBalance: AccountRedesignData["contributionBalance"] = contributionBalanceBase;
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

    contributionBalance = {
      members: memberBalances.map((member) => ({
        userId: member.userId,
        name:
          contributors.find((contributor) => contributor.userId === member.userId)?.name ??
          member.userId.slice(0, 6),
        initials:
          contributors.find((contributor) => contributor.userId === member.userId)?.initials ??
          getAvatarInitials(participantByUserId.get(member.userId)?.email, null),
        color:
          contributors.find((contributor) => contributor.userId === member.userId)?.color ??
          "#2563EB",
        totalPaid: member.totalPaidMinor / divisor,
        totalResponsible: member.totalResponsibleMinor / divisor,
        net: member.netMinor / divisor,
      })),
      debts: memberDebts.map((debt) => ({
        fromUserId: debt.fromUserId,
        fromName:
          contributors.find((contributor) => contributor.userId === debt.fromUserId)?.name ??
          debt.fromUserId.slice(0, 6),
        toUserId: debt.toUserId,
        toName:
          contributors.find((contributor) => contributor.userId === debt.toUserId)?.name ??
          debt.toUserId.slice(0, 6),
        amount: debt.amountMinor / divisor,
      })),
      expenseCategories: expenseContributionCategories,
      incomeCategories: incomeContributionCategories,
    };
  }

  const accountIcon = summary.account.name.slice(0, 1).toUpperCase();

  return {
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
    contributionBalance,
  };
}

export default async function AccountPage(): Promise<JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value ?? "";
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const dictionary = getDictionary(locale);
  if (!activeAccountId) {
    redirect("/select-account");
  }

  // Fetch account summary via RPC
  const { data: summaryData, error: rpcError } = await supabase.rpc(
    "get_account_summary",
    { p_account_id: activeAccountId }
  );

  if (rpcError || !summaryData) {
    console.error("[AccountPage] RPC error:", rpcError);
    redirect("/select-account");
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
    .eq("account_id", activeAccountId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (rowsError) {
    console.error("[AccountPage] Transactions query error:", rowsError);
  }

  const participantIds = (summaryData as AccountSummaryData).participants.map(
    (participant) => participant.user_id
  );
  let profileRows: ProfileColorRow[] = [];
  if (participantIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, avatar_color, avatar_fallback_bg_token")
      .in("user_id", participantIds);
    if (profilesError) {
      console.error("[AccountPage] Profiles query error:", profilesError);
    } else {
      profileRows = (profilesData ?? []) as ProfileColorRow[];
    }
  }
  const profileColorsByUserId = new Map(profileRows.map((profile) => [profile.user_id, profile]));

  const transactions: TransactionRow[] = (rows ?? []).map((row) => ({
    ...row,
    category: normalizeTransactionCategory(row.category),
  }));
  const monthKeys = getRecentMonthKeys(12);
  const dataByMonth = monthKeys.reduce<Record<string, AccountRedesignData>>((acc, monthKey) => {
    acc[monthKey] = buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "month",
      now,
      selectedMonth: monthKey,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
      profileColorsByUserId,
    });
    return acc;
  }, {});
  const currentMonthKey = monthKeys[0] ?? toMonthKey(now);
  if (!dataByMonth[currentMonthKey]) {
    dataByMonth[currentMonthKey] = buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "month",
      now,
      selectedMonth: currentMonthKey,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
      profileColorsByUserId,
    });
  }

  const dataByPeriod: Record<AccountRedesignPeriod, AccountRedesignData> = {
    week: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "week",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
      profileColorsByUserId,
    }),
    month: dataByMonth[currentMonthKey],
    quarter: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "quarter",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
      profileColorsByUserId,
    }),
    year: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "year",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
      profileColorsByUserId,
    }),
  };

  return (
    <div className={cn("min-h-screen bg-background", dmSans.variable, jetbrains.variable)}>
      <TopNav />
      <PageContainer className="space-y-6">
        <AccountRedesignClient
          dataByPeriod={dataByPeriod}
          dataByMonth={dataByMonth}
          monthKeys={monthKeys.length > 0 ? monthKeys : [currentMonthKey]}
          currentUserId={user.id}
        />
      </PageContainer>
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
