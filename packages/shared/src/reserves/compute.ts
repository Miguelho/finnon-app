import type {
  MonthClose,
  MonthCloseAllocation,
  MonthlyProjectFundingPlan,
  ReserveContainerStats,
  ReserveTransfer,
  SavingsMonthView,
} from "./types";

type TxLike = {
  type: "income" | "expense";
  amount_minor?: bigint | number | string | null;
  amount_base_minor?: bigint | number | string | null;
  date?: string | Date | null;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const toPeriodKey = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

export const toMinorSafe = toMinor;

const computeReserveSavingsMonthFromTransactions = (transactions: TxLike[]) => {
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  transactions.forEach((tx) => {
    const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor ?? 0);
    if (tx.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }
  });

  return {
    incomeMinor,
    expenseMinor,
    savingsMinor: incomeMinor - expenseMinor,
  };
};

export const computeSavingsMonthView = (params: {
  period: string;
  transactions: TxLike[];
  fundingPlans?: MonthlyProjectFundingPlan[];
  monthClose?: MonthClose | null;
}): SavingsMonthView => {
  const { period, transactions, fundingPlans = [], monthClose = null } = params;
  const { savingsMinor } = computeReserveSavingsMonthFromTransactions(transactions);
  const plannedToProjectsMinor = fundingPlans.reduce(
    (total, plan) => total + toMinor(plan.planned_amount_base_minor),
    0n
  );
  const availableRawMinor = (savingsMinor > 0n ? savingsMinor : 0n) - plannedToProjectsMinor;
  const isClosed = Boolean(monthClose?.id);

  return {
    period,
    generatedSavedMinor: savingsMinor,
    plannedToProjectsMinor,
    availableToPlanMinor: availableRawMinor > 0n ? availableRawMinor : 0n,
    needsRebalance: plannedToProjectsMinor > (savingsMinor > 0n ? savingsMinor : 0n),
    isClosed,
    closedAt: monthClose?.closed_at ?? null,
    allocatedToProjectsMinor: toMinor(monthClose?.allocated_to_projects_base_minor ?? 0),
    allocatedToReservesMinor: toMinor(monthClose?.allocated_to_reserves_base_minor ?? 0),
  };
};

export const getReserveContainerBalanceMinor = (params: {
  reserveContainerId: string | null | undefined;
  closeAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
}) => {
  const { reserveContainerId, closeAllocations, reserveTransfers } = params;
  if (!reserveContainerId) return 0n;

  const incomingMinor = closeAllocations.reduce((total, allocation) => {
    if (allocation.reserve_container_id !== reserveContainerId) return total;
    return total + toMinor(allocation.amount_base_minor);
  }, 0n);

  const outgoingMinor = reserveTransfers.reduce((total, transfer) => {
    if (transfer.source_reserve_container_id !== reserveContainerId) return total;
    return total + toMinor(transfer.amount_base_minor);
  }, 0n);

  return incomingMinor - outgoingMinor;
};

export const getReserveContainerMonthlySeries = (params: {
  reserveContainerId: string | null | undefined;
  closeAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
  monthClosesById?: Map<string, MonthClose>;
}) => {
  const { reserveContainerId, closeAllocations, reserveTransfers, monthClosesById } = params;
  if (!reserveContainerId) return [] as Array<{ period: string; amountMinor: bigint }>;

  const byPeriod = new Map<string, bigint>();

  closeAllocations.forEach((allocation) => {
    if (allocation.reserve_container_id !== reserveContainerId) return;
    const period = toPeriodKey(
      monthClosesById?.get(allocation.month_close_id)?.period ?? allocation.created_at
    );
    if (!period) return;
    byPeriod.set(period, (byPeriod.get(period) ?? 0n) + toMinor(allocation.amount_base_minor));
  });

  reserveTransfers.forEach((transfer) => {
    if (transfer.source_reserve_container_id !== reserveContainerId) return;
    const period = toPeriodKey(transfer.created_at);
    if (!period) return;
    byPeriod.set(period, (byPeriod.get(period) ?? 0n) - toMinor(transfer.amount_base_minor));
  });

  return Array.from(byPeriod.entries())
    .map(([period, amountMinor]) => ({ period, amountMinor }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
};

export const getReserveContainerStats = (params: {
  reserveContainerId: string | null | undefined;
  closeAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
  monthClosesById?: Map<string, MonthClose>;
  currentPeriod?: string;
}): ReserveContainerStats => {
  const currentPeriod = params.currentPeriod ?? toPeriodKey(new Date()) ?? "";
  const series = getReserveContainerMonthlySeries(params);
  const accumulatedMinor = series.reduce((total, row) => total + row.amountMinor, 0n);
  const currentMonthContributionMinor =
    series.find((row) => row.period === currentPeriod)?.amountMinor ?? 0n;
  const averageMinor = series.length > 0 ? accumulatedMinor / BigInt(series.length) : 0n;
  const bestMonth =
    series.length > 0
      ? series.reduce((best, row) => (row.amountMinor > best.amountMinor ? row : best))
      : null;

  return {
    accumulatedMinor,
    currentMonthContributionMinor,
    averageMinor,
    monthsWithContribution: series.filter((row) => row.amountMinor > 0n).length,
    bestMonth,
    series,
  };
};
