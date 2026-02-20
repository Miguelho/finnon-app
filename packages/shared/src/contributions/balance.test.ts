import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEqualSplit,
  calculateContributionBalance,
  simplifyContributionDebts,
  type ContributionTransaction,
} from "./balance";

test("buildEqualSplit distributes remainder to first members", () => {
  const split = buildEqualSplit(5001, ["a", "b"]);
  assert.deepEqual(split, [
    { userId: "a", shareMinor: 2501 },
    { userId: "b", shareMinor: 2500 },
  ]);
});

test("calculateContributionBalance handles equal, personal and custom", () => {
  const memberIds = ["a", "b"];
  const transactions: ContributionTransaction[] = [
    {
      amountBaseMinor: 5000,
      paidByUserId: "a",
      splitType: "equal",
    },
    {
      amountBaseMinor: 2000,
      paidByUserId: "b",
      splitType: "personal",
    },
    {
      amountBaseMinor: 3000,
      paidByUserId: "a",
      splitType: "custom",
      splitDetails: [
        { userId: "a", shareMinor: 1000 },
        { userId: "b", shareMinor: 2000 },
      ],
    },
  ];

  const result = calculateContributionBalance(transactions, memberIds);

  assert.deepEqual(result, [
    {
      userId: "a",
      totalPaidMinor: 8000,
      totalResponsibleMinor: 5500,
      netMinor: 2500,
    },
    {
      userId: "b",
      totalPaidMinor: 2000,
      totalResponsibleMinor: 4500,
      netMinor: -2500,
    },
  ]);
});

test("simplifyContributionDebts reduces multiple balances to minimal transfers", () => {
  const debts = simplifyContributionDebts(
    [
      { userId: "a", totalPaidMinor: 0, totalResponsibleMinor: 0, netMinor: 5000 },
      { userId: "b", totalPaidMinor: 0, totalResponsibleMinor: 0, netMinor: -3000 },
      { userId: "c", totalPaidMinor: 0, totalResponsibleMinor: 0, netMinor: -2000 },
    ],
    0
  );

  assert.deepEqual(debts, [
    { fromUserId: "b", toUserId: "a", amountMinor: 3000 },
    { fromUserId: "c", toUserId: "a", amountMinor: 2000 },
  ]);
});
