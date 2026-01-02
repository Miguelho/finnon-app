import { test } from "node:test";
import assert from "node:assert/strict";
import { getOccurrencesBetween, type RecurringItem } from "./recurring";

const baseItem: RecurringItem = {
  id: "rec-1",
  account_id: "acc-1",
  type: "expense",
  amount_minor: "1000",
  currency: "USD",
  start_date: "2024-01-31",
  frequency: "monthly",
  interval: 1,
  day_of_month: 31,
  end_date: null,
  is_paused: false,
  created_by: "user-1",
};

test("monthly occurrences normalize to last day of short months (leap year)", () => {
  const occurrences = getOccurrencesBetween(
    baseItem,
    "2024-02-01",
    "2024-03-31"
  );

  assert.deepEqual(
    occurrences.map((item) => item.date),
    ["2024-02-29", "2024-03-31"]
  );
});

test("monthly occurrences normalize to last day of short months (non-leap)", () => {
  const item = { ...baseItem, start_date: "2023-01-31" };
  const occurrences = getOccurrencesBetween(item, "2023-02-01", "2023-02-28");

  assert.deepEqual(occurrences.map((item) => item.date), ["2023-02-28"]);
});
