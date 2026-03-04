import test from "node:test";
import assert from "node:assert/strict";
import { computeCategoryOccurrencesByType } from "./history-occurrence";

test("computeCategoryOccurrencesByType counts occurrences grouped by type", () => {
  const result = computeCategoryOccurrencesByType([
    { type: "expense", category_id: "cat-food" },
    { type: "expense", category_id: "cat-food" },
    { type: "expense", category_id: "cat-home" },
    { type: "income", category_id: "cat-salary" },
    { type: "income", category_id: "cat-salary" },
    { type: "income", category_id: "cat-bonus" },
  ]);

  assert.deepEqual(result.expense, {
    "cat-food": 2,
    "cat-home": 1,
  });
  assert.deepEqual(result.income, {
    "cat-salary": 2,
    "cat-bonus": 1,
  });
});

test("computeCategoryOccurrencesByType ignores null, blank, and missing category_id", () => {
  const result = computeCategoryOccurrencesByType([
    { type: "expense", category_id: null },
    { type: "expense", category_id: "   " },
    { type: "income", category_id: undefined },
    { type: "income", category_id: " cat-ok " },
  ]);

  assert.deepEqual(result.expense, {});
  assert.deepEqual(result.income, { "cat-ok": 1 });
});

test("computeCategoryOccurrencesByType ignores invalid types", () => {
  const result = computeCategoryOccurrencesByType([
    { type: "transfer", category_id: "cat-a" },
    { type: "savings", category_id: "cat-b" },
    { type: null, category_id: "cat-c" },
    { type: "expense", category_id: "cat-valid" },
  ]);

  assert.deepEqual(result.expense, { "cat-valid": 1 });
  assert.deepEqual(result.income, {});
});

test("computeCategoryOccurrencesByType returns empty maps for no valid data", () => {
  const result = computeCategoryOccurrencesByType([
    { type: "transfer", category_id: null },
    { type: undefined, category_id: "" },
  ]);

  assert.deepEqual(result, {
    expense: {},
    income: {},
  });
});
