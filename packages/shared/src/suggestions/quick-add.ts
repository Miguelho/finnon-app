import { startOfDay, toDayKey } from "../date/day";
import type { Transaction } from "../domain/types";
import { normalizeMerchant } from "../merchants";

export interface QuickAddSuggestion {
  merchant: string;
  categoryId: string;
  amount: number;
  frequency: number;
  daymatchRatio: number;
  daysSinceLast: number;
  lastUsed: string;
}

export interface QuickAddConfig {
  minFrequency: number;
  maxSuggestions: number;
  windowDays: number;
}

const DEFAULT_CONFIG: QuickAddConfig = {
  minFrequency: 2,
  maxSuggestions: 3,
  windowDays: 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

type PreparedTransaction = {
  normalizedMerchant: string;
  displayMerchant: string;
  categoryId: string;
  amount: number;
  date: Date;
  timestamp: number;
  dayOfWeek: number;
};

type GroupAmountStats = {
  frequency: number;
  latestTimestamp: number;
};

type GroupStats = {
  merchant: string;
  categoryId: string;
  frequency: number;
  sameDayFrequency: number;
  lastUsedDate: Date;
  lastUsedTimestamp: number;
  amountStats: Map<number, GroupAmountStats>;
};

const parseDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return startOfDay(value);
  }

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
};

const parseAmountMinor = (
  amount: bigint | number | string | null | undefined
): number | null => {
  if (typeof amount === "bigint") {
    const asNumber = Number(amount);
    return Number.isSafeInteger(asNumber) ? asNumber : null;
  }

  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) return null;
    const truncated = Math.trunc(amount);
    return Number.isSafeInteger(truncated) ? truncated : null;
  }

  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!trimmed) return null;
    try {
      const asNumber = Number(BigInt(trimmed));
      return Number.isSafeInteger(asNumber) ? asNumber : null;
    } catch {
      return null;
    }
  }

  return null;
};

const mergeConfig = (config?: Partial<QuickAddConfig>): QuickAddConfig => ({
  minFrequency: config?.minFrequency ?? DEFAULT_CONFIG.minFrequency,
  maxSuggestions: config?.maxSuggestions ?? DEFAULT_CONFIG.maxSuggestions,
  windowDays: config?.windowDays ?? DEFAULT_CONFIG.windowDays,
});

const sanitizeDisplayMerchant = (merchant: string) =>
  merchant.trim().replace(/\s+/g, " ");

const buildGroupKey = (normalizedMerchant: string, categoryId: string) =>
  `${normalizedMerchant}::${categoryId}`;

const computeDaysSince = (reference: Date, target: Date) =>
  Math.max(0, Math.floor((reference.getTime() - target.getTime()) / DAY_MS));

const resolveModeAmount = (amountStats: Map<number, GroupAmountStats>) => {
  let winnerAmount = 0;
  let winnerFrequency = -1;
  let winnerLatestTimestamp = -1;

  amountStats.forEach((stats, amount) => {
    if (
      stats.frequency > winnerFrequency ||
      (stats.frequency === winnerFrequency &&
        stats.latestTimestamp > winnerLatestTimestamp)
    ) {
      winnerAmount = amount;
      winnerFrequency = stats.frequency;
      winnerLatestTimestamp = stats.latestTimestamp;
    }
  });

  return winnerAmount;
};

export function computeQuickAddSuggestions(
  transactions: Transaction[],
  type: Transaction["type"],
  referenceDate: Date,
  config?: Partial<QuickAddConfig>
): QuickAddSuggestion[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const resolvedConfig = mergeConfig(config);
  if (resolvedConfig.maxSuggestions <= 0) return [];

  const referenceStart = startOfDay(referenceDate);
  const windowStart = new Date(referenceStart);
  windowStart.setDate(windowStart.getDate() - resolvedConfig.windowDays);
  const referenceDay = referenceStart.getDay();

  const prepared: PreparedTransaction[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;

    const displayMerchant = sanitizeDisplayMerchant(transaction.merchant ?? "");
    const normalizedMerchant = normalizeMerchant(displayMerchant);
    if (!normalizedMerchant) continue;

    const categoryId =
      typeof transaction.category_id === "string"
        ? transaction.category_id.trim()
        : "";
    if (!categoryId) continue;

    const amount = parseAmountMinor(transaction.amount_minor);
    if (amount === null) continue;

    const date = parseDate(transaction.date);
    if (!date) continue;
    if (date.getTime() < windowStart.getTime() || date.getTime() > referenceStart.getTime()) {
      continue;
    }

    const createdAtDate = parseDate(transaction.created_at ?? null);
    const timestamp = (createdAtDate ?? date).getTime();

    prepared.push({
      normalizedMerchant,
      displayMerchant,
      categoryId,
      amount,
      date,
      timestamp,
      dayOfWeek: date.getDay(),
    });
  }

  if (prepared.length === 0) return [];

  const grouped = new Map<string, GroupStats>();

  prepared.forEach((item) => {
    const key = buildGroupKey(item.normalizedMerchant, item.categoryId);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        merchant: item.displayMerchant,
        categoryId: item.categoryId,
        frequency: 1,
        sameDayFrequency: item.dayOfWeek === referenceDay ? 1 : 0,
        lastUsedDate: item.date,
        lastUsedTimestamp: item.timestamp,
        amountStats: new Map<number, GroupAmountStats>([
          [
            item.amount,
            {
              frequency: 1,
              latestTimestamp: item.timestamp,
            },
          ],
        ]),
      });
      return;
    }

    existing.frequency += 1;
    if (item.dayOfWeek === referenceDay) {
      existing.sameDayFrequency += 1;
    }

    const itemDateTimestamp = item.date.getTime();
    const existingDateTimestamp = existing.lastUsedDate.getTime();
    if (
      itemDateTimestamp > existingDateTimestamp ||
      (itemDateTimestamp === existingDateTimestamp &&
        item.timestamp > existing.lastUsedTimestamp)
    ) {
      existing.lastUsedDate = item.date;
      existing.merchant = item.displayMerchant;
    }
    if (item.timestamp > existing.lastUsedTimestamp) {
      existing.lastUsedTimestamp = item.timestamp;
    }

    const amountStats = existing.amountStats.get(item.amount);
    if (!amountStats) {
      existing.amountStats.set(item.amount, {
        frequency: 1,
        latestTimestamp: item.timestamp,
      });
    } else {
      amountStats.frequency += 1;
      if (item.timestamp > amountStats.latestTimestamp) {
        amountStats.latestTimestamp = item.timestamp;
      }
    }
  });

  const suggestions: QuickAddSuggestion[] = [];

  grouped.forEach((group) => {
    if (group.frequency < resolvedConfig.minFrequency) return;

    const modeAmount = resolveModeAmount(group.amountStats);

    suggestions.push({
      merchant: group.merchant,
      categoryId: group.categoryId,
      amount: modeAmount,
      frequency: group.frequency,
      daymatchRatio: group.sameDayFrequency / group.frequency,
      daysSinceLast: computeDaysSince(referenceStart, group.lastUsedDate),
      lastUsed: toDayKey(group.lastUsedDate),
    });
  });

  suggestions.sort((left, right) => {
    if (right.frequency !== left.frequency) {
      return right.frequency - left.frequency;
    }
    if (right.daymatchRatio !== left.daymatchRatio) {
      return right.daymatchRatio - left.daymatchRatio;
    }
    if (left.daysSinceLast !== right.daysSinceLast) {
      return left.daysSinceLast - right.daysSinceLast;
    }
    if (right.lastUsed !== left.lastUsed) {
      return right.lastUsed.localeCompare(left.lastUsed);
    }
    if (left.categoryId !== right.categoryId) {
      return left.categoryId.localeCompare(right.categoryId);
    }
    return left.merchant.localeCompare(right.merchant);
  });

  return suggestions.slice(0, resolvedConfig.maxSuggestions);
}
