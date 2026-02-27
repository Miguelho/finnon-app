import { isFutureDay } from "../date/day";

export type MovementLikeType = "income" | "expense";
export type MovementLikeStatus = "confirmed" | "pending";

export type MovementLike = {
  type: MovementLikeType;
  amountMinor?: bigint | number | string | null;
  amount_base_minor?: bigint | number | string | null;
  amount_minor?: bigint | number | string | null;
  status?: MovementLikeStatus | null;
  date?: string | Date | null;
};

export type MovementBalanceSummary = {
  totalIncomeMinor: bigint;
  totalExpenseMinor: bigint;
  totalBalanceMinor: bigint;
  confirmedIncomeMinor: bigint;
  confirmedExpenseMinor: bigint;
  confirmedBalanceMinor: bigint;
  movementCount: number;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const resolveStatus = (movement: MovementLike): MovementLikeStatus => {
  if (movement.status === "pending" || movement.status === "confirmed") {
    return movement.status;
  }
  if (movement.date && isFutureDay(movement.date)) {
    return "pending";
  }
  return "confirmed";
};

const getAmountMinor = (movement: MovementLike): bigint =>
  toMinor(movement.amountMinor ?? movement.amount_base_minor ?? movement.amount_minor);

export const computeMovementBalanceSummary = (
  movements: MovementLike[]
): MovementBalanceSummary => {
  let totalIncomeMinor = 0n;
  let totalExpenseMinor = 0n;
  let confirmedIncomeMinor = 0n;
  let confirmedExpenseMinor = 0n;

  movements.forEach((movement) => {
    const amountMinor = getAmountMinor(movement);
    const status = resolveStatus(movement);

    if (movement.type === "income") {
      totalIncomeMinor += amountMinor;
      if (status === "confirmed") {
        confirmedIncomeMinor += amountMinor;
      }
      return;
    }

    totalExpenseMinor += amountMinor;
    if (status === "confirmed") {
      confirmedExpenseMinor += amountMinor;
    }
  });

  return {
    totalIncomeMinor,
    totalExpenseMinor,
    totalBalanceMinor: totalIncomeMinor - totalExpenseMinor,
    confirmedIncomeMinor,
    confirmedExpenseMinor,
    confirmedBalanceMinor: confirmedIncomeMinor - confirmedExpenseMinor,
    movementCount: movements.length,
  };
};

