import test from "node:test";
import assert from "node:assert/strict";
import { computeMovementBalanceSummary } from "./summary";

test("computeMovementBalanceSummary computes totals and confirmed subtotals", () => {
  const summary = computeMovementBalanceSummary([
    { type: "income", amountMinor: "1000", status: "confirmed" },
    { type: "income", amountMinor: 500, status: "pending" },
    { type: "expense", amountMinor: 200n, status: "confirmed" },
    { type: "expense", amountMinor: "50", status: "pending" },
  ]);

  assert.equal(summary.totalIncomeMinor, 1500n);
  assert.equal(summary.totalExpenseMinor, 250n);
  assert.equal(summary.totalBalanceMinor, 1250n);
  assert.equal(summary.confirmedIncomeMinor, 1000n);
  assert.equal(summary.confirmedExpenseMinor, 200n);
  assert.equal(summary.confirmedBalanceMinor, 800n);
  assert.equal(summary.movementCount, 4);
});

test("computeMovementBalanceSummary infers pending status from future date", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const summary = computeMovementBalanceSummary([
    { type: "income", amountMinor: 100, date: tomorrow.toISOString().slice(0, 10) },
  ]);

  assert.equal(summary.totalIncomeMinor, 100n);
  assert.equal(summary.confirmedIncomeMinor, 0n);
});

