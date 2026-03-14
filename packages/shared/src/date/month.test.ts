import { test } from "node:test";
import assert from "node:assert/strict";
import { clampMonthKeyToLatestClosable, getLatestClosableMonthKey } from "./month";

test("getLatestClosableMonthKey returns the previous month", () => {
  assert.equal(getLatestClosableMonthKey("2026-03"), "2026-02");
});

test("clampMonthKeyToLatestClosable keeps past months and clamps current or future months", () => {
  assert.equal(clampMonthKeyToLatestClosable("2026-01", "2026-03"), "2026-01");
  assert.equal(clampMonthKeyToLatestClosable("2026-03", "2026-03"), "2026-02");
  assert.equal(clampMonthKeyToLatestClosable("2026-05", "2026-03"), "2026-02");
});
