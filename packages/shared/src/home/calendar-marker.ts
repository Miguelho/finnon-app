import type { Obligation, Transaction } from "../domain/types";

// Local date utilities (same as home.compute.ts)
const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

/**
 * Data for DayMarker component showing activity indicators.
 */
export type DayMarkerData = {
  /** Total count of all movements (income + expense + pending) */
  total: number;
  /** Count of income transactions */
  incomeCount: number;
  /** Count of expense transactions */
  expenseCount: number;
  /** Count of pending obligations */
  pendingCount: number;
};

/**
 * Computes the marker data for a specific day.
 * Used by DayMarker component to show badge and proportional bar.
 */
export function getDayMarkerData(
  date: Date,
  obligations: Obligation[],
  transactions: Transaction[]
): DayMarkerData {
  const dayKey = toDayKey(date);
  let incomeCount = 0;
  let expenseCount = 0;
  let pendingCount = 0;

  // Count pending obligations for this day
  obligations.forEach((obligation) => {
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || toDayKey(dueDate) !== dayKey) return;
    if (obligation.status !== "paid") {
      pendingCount++;
    }
  });

  // Count transactions by type
  transactions.forEach((transaction) => {
    const txDate = toDate(transaction.date);
    if (!txDate || !isSameDay(txDate, date)) return;

    if (transaction.type === "income") {
      incomeCount++;
    } else {
      expenseCount++;
    }
  });

  return {
    total: incomeCount + expenseCount + pendingCount,
    incomeCount,
    expenseCount,
    pendingCount,
  };
}

/**
 * Formats the badge text for DayMarker.
 * Shows "9+" when total >= 10.
 */
export function formatMarkerBadge(total: number): string {
  if (total >= 10) return "9+";
  return String(total);
}

/**
 * Computes marker data for all days in a date range.
 * Returns a Map keyed by dayKey (YYYY-MM-DD) for efficient lookup.
 */
export function getMarkerDataForRange(
  startDate: Date,
  endDate: Date,
  obligations: Obligation[],
  transactions: Transaction[]
): Map<string, DayMarkerData> {
  const result = new Map<string, DayMarkerData>();
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayKey = toDayKey(current);
    const data = getDayMarkerData(current, obligations, transactions);

    // Only store if there's activity
    if (data.total > 0) {
      result.set(dayKey, data);
    }

    current.setDate(current.getDate() + 1);
  }

  return result;
}
