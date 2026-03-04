import test from "node:test";
import assert from "node:assert/strict";
import { computeQuickAddSuggestions } from "./quick-add";
import type { Transaction } from "../domain/types";

const makeTransaction = (
  overrides: Partial<Transaction> & Pick<Transaction, "id" | "type" | "date">
): Transaction => ({
  id: overrides.id,
  account_id: overrides.account_id ?? "acc-1",
  type: overrides.type,
  amount_minor: overrides.amount_minor ?? "1000",
  currency: overrides.currency ?? "EUR",
  date: overrides.date,
  merchant: overrides.merchant ?? "merchant",
  category_id: overrides.category_id ?? "cat-1",
  created_at: overrides.created_at,
});

test("computeQuickAddSuggestions orders by frequency, daymatchRatio, and recency", () => {
  const referenceDate = new Date(2024, 0, 8); // Monday
  const transactions: Transaction[] = [
    // netflix + cat-a -> frequency 3, daymatch 2/3
    makeTransaction({
      id: "t1",
      type: "expense",
      date: "2024-01-08",
      merchant: "Netflix",
      category_id: "cat-a",
      amount_minor: "999",
    }),
    makeTransaction({
      id: "t2",
      type: "expense",
      date: "2024-01-01",
      merchant: "  NETFLIX ",
      category_id: "cat-a",
      amount_minor: "999",
    }),
    makeTransaction({
      id: "t3",
      type: "expense",
      date: "2024-01-07",
      merchant: "netflix",
      category_id: "cat-a",
      amount_minor: "1099",
    }),
    // uber + cat-b -> frequency 3, daymatch 1/3
    makeTransaction({
      id: "t4",
      type: "expense",
      date: "2024-01-08",
      merchant: "Uber",
      category_id: "cat-b",
      amount_minor: "500",
    }),
    makeTransaction({
      id: "t5",
      type: "expense",
      date: "2024-01-03",
      merchant: "uber",
      category_id: "cat-b",
      amount_minor: "500",
    }),
    makeTransaction({
      id: "t6",
      type: "expense",
      date: "2023-12-28",
      merchant: " UBER ",
      category_id: "cat-b",
      amount_minor: "500",
    }),
    // cafe + cat-c -> frequency 2
    makeTransaction({
      id: "t7",
      type: "expense",
      date: "2024-01-07",
      merchant: "Cafe",
      category_id: "cat-c",
      amount_minor: "200",
    }),
    makeTransaction({
      id: "t8",
      type: "expense",
      date: "2024-01-06",
      merchant: "CAFE",
      category_id: "cat-c",
      amount_minor: "200",
    }),
  ];

  const suggestions = computeQuickAddSuggestions(
    transactions,
    "expense",
    referenceDate
  );

  assert.equal(suggestions.length, 3);
  assert.equal(suggestions[0]?.merchant, "Netflix");
  assert.equal(suggestions[1]?.merchant, "Uber");
  assert.equal(suggestions[2]?.merchant, "Cafe");
  assert.equal(suggestions[0]?.frequency, 3);
  assert.equal(suggestions[0]?.daymatchRatio, 2 / 3);
  assert.equal(suggestions[1]?.daymatchRatio, 1 / 3);
});

test("computeQuickAddSuggestions keeps display merchant format from latest usage", () => {
  const referenceDate = new Date(2024, 0, 8);
  const transactions: Transaction[] = [
    makeTransaction({
      id: "d1",
      type: "expense",
      date: "2024-01-03",
      merchant: "cafe rio",
      category_id: "cat-food",
      amount_minor: "1500",
    }),
    makeTransaction({
      id: "d2",
      type: "expense",
      date: "2024-01-08",
      merchant: "  Café   Río  ",
      category_id: "cat-food",
      amount_minor: "1500",
    }),
  ];

  const suggestions = computeQuickAddSuggestions(
    transactions,
    "expense",
    referenceDate
  );

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.merchant, "Café Río");
});

test("computeQuickAddSuggestions resolves mode amount by recency on ties", () => {
  const referenceDate = new Date(2024, 0, 8);
  const transactions: Transaction[] = [
    makeTransaction({
      id: "a",
      type: "expense",
      date: "2024-01-02",
      created_at: "2024-01-02T08:00:00Z",
      merchant: "Gym",
      category_id: "cat-gym",
      amount_minor: "1000",
    }),
    makeTransaction({
      id: "b",
      type: "expense",
      date: "2024-01-03",
      created_at: "2024-01-03T08:00:00Z",
      merchant: "GYM",
      category_id: "cat-gym",
      amount_minor: "1200",
    }),
  ];

  const suggestions = computeQuickAddSuggestions(
    transactions,
    "expense",
    referenceDate
  );

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.amount, 1200);
});

test("computeQuickAddSuggestions enforces filters and min frequency", () => {
  const referenceDate = new Date(2024, 0, 8);
  const transactions: Transaction[] = [
    // valid income group (2 entries)
    makeTransaction({
      id: "i1",
      type: "income",
      date: "2024-01-08",
      merchant: "Salary",
      category_id: "cat-income",
      amount_minor: "200000",
    }),
    makeTransaction({
      id: "i2",
      type: "income",
      date: "2024-01-05",
      merchant: "salary",
      category_id: "cat-income",
      amount_minor: "200000",
    }),
    // ignored: blank merchant
    makeTransaction({
      id: "x1",
      type: "income",
      date: "2024-01-04",
      merchant: "   ",
      category_id: "cat-income",
      amount_minor: "200000",
    }),
    // ignored: missing category
    makeTransaction({
      id: "x2",
      type: "income",
      date: "2024-01-04",
      merchant: "Bonus",
      category_id: null,
      amount_minor: "50000",
    }),
    // ignored: outside window
    makeTransaction({
      id: "x3",
      type: "income",
      date: "2023-08-01",
      merchant: "Salary",
      category_id: "cat-income",
      amount_minor: "200000",
    }),
    // ignored: wrong type
    makeTransaction({
      id: "x4",
      type: "expense",
      date: "2024-01-02",
      merchant: "Salary",
      category_id: "cat-income",
      amount_minor: "200000",
    }),
  ];

  const suggestions = computeQuickAddSuggestions(
    transactions,
    "income",
    referenceDate
  );

  assert.deepEqual(suggestions.map((item) => item.categoryId), ["cat-income"]);
  assert.equal(suggestions[0]?.frequency, 2);
});
