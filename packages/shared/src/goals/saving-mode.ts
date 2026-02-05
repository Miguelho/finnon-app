export type SavingsReasonCode =
  | "HIGH_IMPACT"
  | "FLEX_CATEGORY"
  | "NON_RECURRENT"
  | "REPEATED_MERCHANT"
  | "CATEGORY_SPIKE";

export type SavingsSectionKind = "HIGH_IMPACT" | "REPEATED" | "UNUSUAL";

export const SAVINGS_CATEGORY_PREFIX = "__category__:";

export const getSavingsCategoryId = (value?: string | null) => {
  if (!value) return null;
  return value.startsWith(SAVINGS_CATEGORY_PREFIX)
    ? value.slice(SAVINGS_CATEGORY_PREFIX.length)
    : null;
};

import type { CompletionStatus, MonthStatus } from "./types";

export type SavingsSummary = {
  // Legacy (mantener para compatibilidad)
  incomeMinor: bigint;
  expenseMinor: bigint;
  savedMinor: bigint;
  targetMinor: bigint;
  gapToGoalMinor: bigint;
  expectedSavedByTodayMinor: bigint;
  deltaVsExpectedMinor: bigint;
  requiredDailyFromTodayMinor: bigint;
  monthStart: string;
  monthEnd: string;
  today: string;
  // V2: Métricas nuevas
  incomeRealMinor?: bigint;
  expenseRealMinor?: bigint;
  incomePendingMinor?: bigint;
  expensePendingMinor?: bigint;
  savedRealMinor?: bigint;
  savedTotalMinor?: bigint;
  completionStatus?: CompletionStatus;
  estimatedCompletionDate?: string | null;
  monthStatus?: MonthStatus;
};

export type SavingsCandidateTx = {
  id: string;
  date: string;
  amountBaseMinor: bigint;
  currency: string;
  merchant: string | null;
  merchantNorm?: string | null;
  categoryId?: string | null;
  gapContributionPct?: number | null;
  saveScore?: number | null;
  reasonCodes: SavingsReasonCode[];
  // V2: Impacto en días
  delayDays?: number | null;
};

export type SavingsCandidateMerchant = {
  merchantNorm: string;
  count: number;
  sumBaseMinor: bigint;
  topTx: Array<{
    id: string;
    date: string;
    amountBaseMinor: bigint;
    currency: string;
    merchant: string | null;
    categoryId?: string | null;
  }>;
  reasonCodes: SavingsReasonCode[];
};

export type SavingsSection =
  | { kind: "HIGH_IMPACT"; items: SavingsCandidateTx[] }
  | { kind: "REPEATED"; items: SavingsCandidateMerchant[] }
  | { kind: "UNUSUAL"; items: SavingsCandidateTx[] };

export type SavingsCandidatesResponse = {
  summary: SavingsSummary | null;
  sections: SavingsSection[];
  appliedFilters?: {
    month?: string;
    type?: string;
    order?: string;
    origin?: string;
  };
};

const toBigInt = (value: unknown) => {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return 0n;
  }
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toString = (value: unknown) =>
  typeof value === "string" ? value : value ? String(value) : "";

const toReasonCodes = (value: unknown): SavingsReasonCode[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SavingsReasonCode => {
    return (
      entry === "HIGH_IMPACT" ||
      entry === "FLEX_CATEGORY" ||
      entry === "NON_RECURRENT" ||
      entry === "REPEATED_MERCHANT" ||
      entry === "CATEGORY_SPIKE"
    );
  });
};

const toCompletionStatus = (value: unknown): CompletionStatus | undefined => {
  if (
    value === "completed_today" ||
    value === "completion_date" ||
    value === "not_achievable"
  ) {
    return value;
  }
  return undefined;
};

const toMonthStatus = (value: unknown): MonthStatus | undefined => {
  if (
    value === "adelantado" ||
    value === "en_riesgo" ||
    value === "retrasado"
  ) {
    return value;
  }
  return undefined;
};

const parseSummary = (summary: any): SavingsSummary | null => {
  if (!summary || typeof summary !== "object") return null;
  return {
    // Legacy
    incomeMinor: toBigInt(summary.incomeMinor),
    expenseMinor: toBigInt(summary.expenseMinor),
    savedMinor: toBigInt(summary.savedMinor),
    targetMinor: toBigInt(summary.targetMinor),
    gapToGoalMinor: toBigInt(summary.gapToGoalMinor),
    expectedSavedByTodayMinor: toBigInt(summary.expectedSavedByTodayMinor),
    deltaVsExpectedMinor: toBigInt(summary.deltaVsExpectedMinor),
    requiredDailyFromTodayMinor: toBigInt(summary.requiredDailyFromTodayMinor),
    monthStart: toString(summary.monthStart),
    monthEnd: toString(summary.monthEnd),
    today: toString(summary.today),
    // V2
    incomeRealMinor:
      summary.incomeRealMinor !== undefined
        ? toBigInt(summary.incomeRealMinor)
        : undefined,
    expenseRealMinor:
      summary.expenseRealMinor !== undefined
        ? toBigInt(summary.expenseRealMinor)
        : undefined,
    incomePendingMinor:
      summary.incomePendingMinor !== undefined
        ? toBigInt(summary.incomePendingMinor)
        : undefined,
    expensePendingMinor:
      summary.expensePendingMinor !== undefined
        ? toBigInt(summary.expensePendingMinor)
        : undefined,
    savedRealMinor:
      summary.savedRealMinor !== undefined
        ? toBigInt(summary.savedRealMinor)
        : undefined,
    savedTotalMinor:
      summary.savedTotalMinor !== undefined
        ? toBigInt(summary.savedTotalMinor)
        : undefined,
    completionStatus: toCompletionStatus(summary.completionStatus),
    estimatedCompletionDate:
      typeof summary.estimatedCompletionDate === "string"
        ? summary.estimatedCompletionDate
        : null,
    monthStatus: toMonthStatus(summary.monthStatus),
  };
};

const parseTxItem = (item: any): SavingsCandidateTx | null => {
  if (!item || typeof item !== "object") return null;
  const id = toString(item.id);
  if (!id) return null;
  return {
    id,
    date: toString(item.date),
    amountBaseMinor: toBigInt(item.amountBaseMinor),
    currency: toString(item.currency),
    merchant: typeof item.merchant === "string" ? item.merchant : null,
    merchantNorm:
      typeof item.merchantNorm === "string" ? item.merchantNorm : null,
    categoryId: typeof item.categoryId === "string" ? item.categoryId : null,
    gapContributionPct:
      item.gapContributionPct === null || item.gapContributionPct === undefined
        ? null
        : toNumber(item.gapContributionPct),
    saveScore:
      item.saveScore === null || item.saveScore === undefined
        ? null
        : toNumber(item.saveScore),
    reasonCodes: toReasonCodes(item.reasonCodes),
    // V2: Impacto en días
    delayDays:
      item.delayDays === null || item.delayDays === undefined
        ? null
        : toNumber(item.delayDays),
  };
};

const parseMerchantItem = (item: any): SavingsCandidateMerchant | null => {
  if (!item || typeof item !== "object") return null;
  const merchantNorm = toString(item.merchantNorm);
  if (!merchantNorm) return null;
  const topTx = Array.isArray(item.topTx)
    ? item.topTx
        .map((tx) => ({
          id: toString(tx?.id),
          date: toString(tx?.date),
          amountBaseMinor: toBigInt(tx?.amountBaseMinor),
          currency: toString(tx?.currency),
          merchant: typeof tx?.merchant === "string" ? tx.merchant : null,
          categoryId: typeof tx?.categoryId === "string" ? tx.categoryId : null,
        }))
        .filter((tx) => tx.id)
    : [];
  return {
    merchantNorm,
    count: toNumber(item.count),
    sumBaseMinor: toBigInt(item.sumBaseMinor),
    topTx,
    reasonCodes: toReasonCodes(item.reasonCodes),
  };
};

export const parseSavingsCandidates = (
  payload: unknown
): SavingsCandidatesResponse => {
  if (!payload || typeof payload !== "object") {
    return { summary: null, sections: [] };
  }

  const raw = payload as Record<string, any>;
  const summary = parseSummary(raw.summary);
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: SavingsSection[] = [];

  sectionsRaw.forEach((section) => {
    const kind = toString(section?.kind) as SavingsSectionKind;
    const itemsRaw = Array.isArray(section?.items) ? section.items : [];
    if (kind === "REPEATED") {
      const items = itemsRaw
        .map(parseMerchantItem)
        .filter((item): item is SavingsCandidateMerchant => Boolean(item));
      sections.push({ kind, items });
      return;
    }
    if (kind === "HIGH_IMPACT" || kind === "UNUSUAL") {
      const items = itemsRaw
        .map(parseTxItem)
        .filter((item): item is SavingsCandidateTx => Boolean(item));
      sections.push({ kind, items });
    }
  });

  const appliedFilters =
    raw.appliedFilters && typeof raw.appliedFilters === "object"
      ? {
          month: toString(raw.appliedFilters.month),
          type: toString(raw.appliedFilters.type),
          order: toString(raw.appliedFilters.order),
          origin: toString(raw.appliedFilters.origin),
        }
      : undefined;

  return { summary, sections, appliedFilters };
};

export const savingsReasonPriority: SavingsReasonCode[] = [
  "HIGH_IMPACT",
  "NON_RECURRENT",
  "CATEGORY_SPIKE",
  "REPEATED_MERCHANT",
  "FLEX_CATEGORY",
];

export const getPrimarySavingsReason = (
  reasons: SavingsReasonCode[],
  priority: SavingsReasonCode[] = savingsReasonPriority
): SavingsReasonCode | null => {
  for (const reason of priority) {
    if (reasons.includes(reason)) return reason;
  }
  return reasons[0] ?? null;
};

export const getSavingsReasonCopyKey = (reason: SavingsReasonCode) => {
  switch (reason) {
    case "HIGH_IMPACT":
      return "saving.reasons.highImpact";
    case "FLEX_CATEGORY":
      return "saving.reasons.flexCategory";
    case "NON_RECURRENT":
      return "saving.reasons.nonRecurrent";
    case "REPEATED_MERCHANT":
      return "saving.reasons.repeatedMerchant";
    case "CATEGORY_SPIKE":
      return "saving.reasons.categorySpike";
    default:
      return "saving.reasons.highImpact";
  }
};
