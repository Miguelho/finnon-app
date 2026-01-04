import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMonthlySummary,
  getMonthRange,
  getUpcomingCashflowWindow,
} from "./home.compute";
import type { Obligation, Transaction } from "../domain/types";

test("computeMonthlySummary tracks commitments and activity in month", () => {
  const monthRange = getMonthRange(new Date("2024-03-10T00:00:00Z"));

  const obligations: Obligation[] = [
    {
      id: "obl-1",
      account_id: "acc-1",
      name: "Rent",
      amount_minor: "1000",
      amount_base_minor: "1000",
      currency: "USD",
      due_date: "2024-03-05",
      status: "pending",
    },
    {
      id: "obl-2",
      account_id: "acc-1",
      name: "Insurance",
      amount_minor: "2000",
      amount_base_minor: "2000",
      currency: "USD",
      due_date: "2024-03-10",
      status: "paid",
    },
    {
      id: "obl-3",
      account_id: "acc-1",
      name: "Outside",
      amount_minor: "3000",
      amount_base_minor: "3000",
      currency: "USD",
      due_date: "2024-04-01",
      status: "pending",
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "tx-1",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "500",
      amount_base_minor: "500",
      currency: "USD",
      date: "2024-03-06",
    },
    {
      id: "tx-2",
      account_id: "acc-1",
      type: "income",
      amount_minor: "700",
      amount_base_minor: "700",
      currency: "USD",
      date: "2024-03-07",
    },
    {
      id: "tx-3",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "400",
      amount_base_minor: "400",
      currency: "USD",
      date: "2024-04-02",
    },
  ];

  const summary = computeMonthlySummary(obligations, transactions, monthRange);

  assert.equal(summary.committedMinor, 3000n);
  assert.equal(summary.pendingMinor, 1000n);
  assert.equal(summary.paidMinor, 2000n);
  assert.equal(summary.registeredMinor, 500n);
  assert.equal(summary.obligationsCount, 2);
  assert.equal(summary.activityCount, 2);
});

test("getUpcomingCashflowWindow respects a 7-day window", () => {
  const range = {
    start: new Date("2024-05-10T00:00:00Z"),
    end: new Date("2024-05-16T23:59:59Z"),
  };

  const obligations: Obligation[] = [
    {
      id: "obl-1",
      account_id: "acc-1",
      name: "Gym",
      amount_minor: "1000",
      amount_base_minor: "1000",
      currency: "USD",
      due_date: "2024-05-12",
      status: "pending",
    },
    {
      id: "obl-2",
      account_id: "acc-1",
      name: "Utilities",
      amount_minor: "2000",
      amount_base_minor: "2000",
      currency: "USD",
      due_date: "2024-05-18",
      status: "pending",
    },
    {
      id: "obl-3",
      account_id: "acc-1",
      name: "Paid already",
      amount_minor: "500",
      amount_base_minor: "500",
      currency: "USD",
      due_date: "2024-05-13",
      status: "paid",
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "tx-1",
      account_id: "acc-1",
      type: "income",
      amount_minor: "1500",
      amount_base_minor: "1500",
      currency: "USD",
      date: "2024-05-11",
      merchant: "Salary",
    },
    {
      id: "tx-2",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "300",
      amount_base_minor: "300",
      currency: "USD",
      date: "2024-05-15",
      merchant: "Groceries",
    },
    {
      id: "tx-3",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "400",
      amount_base_minor: "400",
      currency: "USD",
      date: "2024-05-20",
      merchant: "Internet",
    },
  ];

  const cashflow = getUpcomingCashflowWindow(
    obligations,
    transactions,
    range,
    "USD",
    "Movement"
  );

  assert.equal(cashflow.incomeMinor, 1500n);
  assert.equal(cashflow.expenseMinor, 1300n);
  assert.deepEqual(
    cashflow.items.map((item) => item.id),
    ["tx-1", "obl-1", "tx-2"]
  );
});

test("getUpcomingCashflowWindow respects a 14-day window", () => {
  const range = {
    start: new Date("2024-05-10T00:00:00Z"),
    end: new Date("2024-05-24T23:59:59Z"),
  };

  const obligations: Obligation[] = [
    {
      id: "obl-1",
      account_id: "acc-1",
      name: "Gym",
      amount_minor: "1000",
      amount_base_minor: "1000",
      currency: "USD",
      due_date: "2024-05-12",
      status: "pending",
    },
    {
      id: "obl-2",
      account_id: "acc-1",
      name: "Utilities",
      amount_minor: "2000",
      amount_base_minor: "2000",
      currency: "USD",
      due_date: "2024-05-18",
      status: "pending",
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "tx-1",
      account_id: "acc-1",
      type: "income",
      amount_minor: "1500",
      amount_base_minor: "1500",
      currency: "USD",
      date: "2024-05-11",
      merchant: "Salary",
    },
    {
      id: "tx-2",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "300",
      amount_base_minor: "300",
      currency: "USD",
      date: "2024-05-15",
      merchant: "Groceries",
    },
    {
      id: "tx-3",
      account_id: "acc-1",
      type: "expense",
      amount_minor: "400",
      amount_base_minor: "400",
      currency: "USD",
      date: "2024-05-20",
      merchant: "Internet",
    },
  ];

  const cashflow = getUpcomingCashflowWindow(
    obligations,
    transactions,
    range,
    "USD",
    "Movement"
  );

  assert.equal(cashflow.incomeMinor, 1500n);
  assert.equal(cashflow.expenseMinor, 3700n);
  assert.deepEqual(
    cashflow.items.map((item) => item.id),
    ["tx-1", "obl-1", "tx-2", "obl-2", "tx-3"]
  );
});
