import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CURRENCY_MINOR_UNITS,
  computeAmountBaseMinor,
  formatMinorToMoney,
  parseMoneyToMinor,
} from "./money";

test("parseMoneyToMinor handles EUR decimals", () => {
  const result = parseMoneyToMinor("12.30", "EUR", CURRENCY_MINOR_UNITS);
  assert.equal(result, 1230n);
});

test("parseMoneyToMinor handles JPY with no decimals", () => {
  const result = parseMoneyToMinor("1200", "JPY", CURRENCY_MINOR_UNITS);
  assert.equal(result, 1200n);
});

test("parseMoneyToMinor handles KWD with 3 decimals", () => {
  const result = parseMoneyToMinor("1.234", "KWD", CURRENCY_MINOR_UNITS);
  assert.equal(result, 1234n);
});

test("formatMinorToMoney formats with correct decimals", () => {
  const formatted = formatMinorToMoney(1234n, "KWD", CURRENCY_MINOR_UNITS);
  assert.equal(formatted, "1.234");
});

test("computeAmountBaseMinor rounds HALF_UP", () => {
  const amountMinor = 100n; // 1.00 USD
  const result = computeAmountBaseMinor({
    amountMinor,
    currency: "USD",
    baseCurrency: "EUR",
    fxRate: "0.91",
    currencyMeta: CURRENCY_MINOR_UNITS,
  });

  assert.equal(result, 91n);
});
