export type ContributionSplitType = "equal" | "personal" | "custom";

export type ContributionSplitDetail = {
  userId: string;
  shareMinor: number;
};

export type ContributionTransaction = {
  id?: string;
  amountBaseMinor: number;
  paidByUserId: string;
  splitType: ContributionSplitType;
  splitDetails?: ContributionSplitDetail[] | null;
};

export type ContributionBalanceResult = {
  userId: string;
  totalPaidMinor: number;
  totalResponsibleMinor: number;
  netMinor: number;
};

export type ContributionDebt = {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
};

const toSafeInteger = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
};

export function buildEqualSplit(
  amountMinor: number,
  memberIds: string[]
): ContributionSplitDetail[] {
  if (memberIds.length === 0) return [];
  const total = Math.max(0, toSafeInteger(amountMinor));
  const base = Math.floor(total / memberIds.length);
  const remainder = total % memberIds.length;
  return memberIds.map((userId, index) => ({
    userId,
    shareMinor: base + (index < remainder ? 1 : 0),
  }));
}

export function resolveResponsibleSplit(
  transaction: ContributionTransaction,
  memberIds: string[]
): ContributionSplitDetail[] {
  if (memberIds.length === 0) return [];

  const total = Math.max(0, toSafeInteger(transaction.amountBaseMinor));
  if (total === 0) {
    return memberIds.map((userId) => ({ userId, shareMinor: 0 }));
  }

  if (transaction.splitType === "equal") {
    return buildEqualSplit(total, memberIds);
  }

  if (transaction.splitType === "personal") {
    const owner = memberIds.includes(transaction.paidByUserId)
      ? transaction.paidByUserId
      : memberIds[0];
    return memberIds.map((userId) => ({
      userId,
      shareMinor: userId === owner ? total : 0,
    }));
  }

  const current = new Map(memberIds.map((userId) => [userId, 0]));
  (transaction.splitDetails ?? []).forEach((split) => {
    const normalized = toSafeInteger(split.shareMinor);
    if (!current.has(split.userId) || normalized < 0) return;
    current.set(split.userId, normalized);
  });

  const sum = Array.from(current.values()).reduce((acc, value) => acc + value, 0);
  if (sum !== total) {
    // Defensive fallback for malformed data.
    return buildEqualSplit(total, memberIds);
  }

  return memberIds.map((userId) => ({
    userId,
    shareMinor: current.get(userId) ?? 0,
  }));
}

export function calculateContributionBalance(
  transactions: ContributionTransaction[],
  memberIds: string[]
): ContributionBalanceResult[] {
  const uniqueMembers = Array.from(new Set(memberIds));
  const balance = new Map<string, { paid: number; responsible: number }>();

  uniqueMembers.forEach((userId) => {
    balance.set(userId, { paid: 0, responsible: 0 });
  });

  transactions.forEach((transaction) => {
    const total = Math.max(0, toSafeInteger(transaction.amountBaseMinor));
    if (total <= 0) return;

    const paidEntry = balance.get(transaction.paidByUserId);
    if (paidEntry) {
      paidEntry.paid += total;
    }

    const responsible = resolveResponsibleSplit(transaction, uniqueMembers);
    responsible.forEach((split) => {
      const entry = balance.get(split.userId);
      if (!entry) return;
      entry.responsible += Math.max(0, toSafeInteger(split.shareMinor));
    });
  });

  return uniqueMembers.map((userId) => {
    const totals = balance.get(userId) ?? { paid: 0, responsible: 0 };
    return {
      userId,
      totalPaidMinor: totals.paid,
      totalResponsibleMinor: totals.responsible,
      netMinor: totals.paid - totals.responsible,
    };
  });
}

export function simplifyContributionDebts(
  balances: ContributionBalanceResult[],
  minSettlementMinor = 0
): ContributionDebt[] {
  const epsilon = Math.max(0, toSafeInteger(minSettlementMinor));

  const creditors = balances
    .filter((item) => item.netMinor > epsilon)
    .map((item) => ({ userId: item.userId, amount: item.netMinor }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((item) => item.netMinor < -epsilon)
    .map((item) => ({ userId: item.userId, amount: -item.netMinor }))
    .sort((a, b) => b.amount - a.amount);

  const debts: ContributionDebt[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const settled = Math.min(creditor.amount, debtor.amount);

    if (settled > epsilon) {
      debts.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountMinor: settled,
      });
    }

    creditor.amount -= settled;
    debtor.amount -= settled;

    if (creditor.amount <= epsilon) creditorIndex += 1;
    if (debtor.amount <= epsilon) debtorIndex += 1;
  }

  return debts;
}
