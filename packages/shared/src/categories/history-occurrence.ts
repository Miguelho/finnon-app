export type CategoryOccurrencesByType = {
  expense: Record<string, number>;
  income: Record<string, number>;
};

type TransactionLike = {
  type?: unknown;
  category_id?: unknown;
};

export const EMPTY_CATEGORY_OCCURRENCES_BY_TYPE: CategoryOccurrencesByType = {
  expense: {},
  income: {},
};

const isSupportedType = (
  value: unknown
): value is keyof CategoryOccurrencesByType =>
  value === "expense" || value === "income";

const normalizeCategoryId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export function computeCategoryOccurrencesByType(
  transactions: TransactionLike[]
): CategoryOccurrencesByType {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { expense: {}, income: {} };
  }

  const occurrences: CategoryOccurrencesByType = {
    expense: {},
    income: {},
  };

  for (const transaction of transactions) {
    if (!isSupportedType(transaction?.type)) continue;

    const categoryId = normalizeCategoryId(transaction?.category_id);
    if (!categoryId) continue;

    const currentCount = occurrences[transaction.type][categoryId] ?? 0;
    occurrences[transaction.type][categoryId] = currentCount + 1;
  }

  return occurrences;
}
