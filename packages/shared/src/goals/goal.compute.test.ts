import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeGoalProgress,
  computeGoalInsights,
  getGoalTotalsFromTransactions,
} from "./goal.compute";
import type { FinancialGoal, GoalTransaction } from "./types";

test("computeGoalProgress derives savings pace and status", () => {
  const goal: FinancialGoal = {
    id: "goal-1",
    account_id: "acc-1",
    month: "2024-04",
    type: "save",
    target_amount_base_minor: "30000",
    created_by: "user-1",
  };

  const transactions: GoalTransaction[] = [
    { type: "income", amount_base_minor: "20000" },
    { type: "expense", amount_base_minor: "5000" },
  ];

  const totals = getGoalTotalsFromTransactions(transactions);
  const progress = computeGoalProgress({
    goal,
    totals,
    now: new Date(2024, 3, 10),
  });

  assert.ok(progress);
  assert.equal(progress.savedMinor, 15000n);
  assert.equal(progress.remainingMinor, 15000n);
  assert.equal(progress.daysLeft, 21);
  assert.equal(progress.ratePerDayMinor, 715n);
  assert.equal(progress.forecastEndMinor, 45000n);
  assert.equal(progress.status, "positive");
});

test("computeGoalInsights returns forecast, delta, and top categories", () => {
  const goal: FinancialGoal = {
    id: "goal-2",
    account_id: "acc-1",
    month: "2024-05",
    type: "save",
    target_amount_base_minor: "50000",
    created_by: "user-1",
  };

  const transactions: GoalTransaction[] = [
    { type: "income", amount_base_minor: "40000" },
    {
      type: "expense",
      amount_base_minor: "5000",
      category: { id: "cat-1", name: "Rent", icon_id: "House" },
    },
    {
      type: "expense",
      amount_base_minor: "2000",
      category: { id: "cat-2", name: "Food", icon_id: "ForkKnife" },
    },
    {
      type: "expense",
      amount_base_minor: "1000",
      category: { id: "cat-3", name: "Travel", icon_id: "Airplane" },
    },
  ];

  const totals = getGoalTotalsFromTransactions(transactions);
  const progress = computeGoalProgress({
    goal,
    totals,
    now: new Date(2024, 4, 12),
  });

  const insights = computeGoalInsights({
    progress,
    totals,
    transactions,
    previousExpenseTotalMinor: 5000n,
    uncategorizedLabel: "Sin categoría",
    copy: {
      forecast: (amount) => `forecast:${amount}`,
      expenseUp: (amount) => `up:${amount}`,
      expenseDown: (amount) => `down:${amount}`,
      expenseEven: "even",
      topCategories: (categories) => `top:${categories}`,
    },
    formatters: {
      formatSignedMoney: (value) => `${value}m`,
      formatMoney: (value) => `${value}m`,
    },
  });

  assert.equal(insights[0]?.id, "forecast");
  assert.equal(insights[0]?.body, "forecast:45000m");
  assert.equal(insights[1]?.id, "mom_expense");
  assert.equal(insights[1]?.body, "up:3000m");
  assert.equal(insights[1]?.status, "negative");
  assert.equal(insights[2]?.id, "top_categories");
  assert.deepEqual(
    insights[2]?.categories?.map((item) => item.categoryId) ?? [],
    ["cat-1", "cat-2", "cat-3"]
  );
});
