/**
 * Money utilities for handling amounts in minor units (cents)
 * to avoid floating point errors
 */

// Currency minor units (decimal places)
// Based on ISO 4217 standard
export type CurrencyMeta = Record<string, number>;

export const CURRENCY_MINOR_UNITS: CurrencyMeta = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  JPY: 0, // Japanese Yen has no decimals
  CHF: 2,
  CAD: 2,
  AUD: 2,
  MXN: 2,
  BRL: 2,
  ARS: 2,
  COP: 2,
  CLP: 0, // Chilean Peso has no decimals
  PEN: 2,
  KWD: 3, // Kuwaiti Dinar has 3 decimals
  BHD: 3, // Bahraini Dinar has 3 decimals
  PLN: 2,
};

/**
 * Get the number of decimal places for a currency
 * Defaults to 2 if currency not found
 */
export function getMinorUnits(
  currency: string,
  currencyMeta: CurrencyMeta = CURRENCY_MINOR_UNITS
): number {
  return currencyMeta[currency] ?? 2;
}

export type MoneyParseError = {
  key:
    | "money.amountRequired"
    | "money.invalidFormat"
    | "money.maxDecimalPlaces"
    | "money.noDecimalPlaces"
    | "money.negativeAmount"
    | "money.invalidAmount";
  params?: Record<string, string | number>;
};

export type MoneyParseResult = bigint | { error: MoneyParseError };

type FxRateParseError = {
  key: "transactions.fxRateInvalid";
};

export type FxRateParseResult = bigint | { error: FxRateParseError };

const FX_RATE_SCALE = 10;

const pow10BigInt = (exp: number) => {
  if (exp <= 0) return 1n;
  return 10n ** BigInt(exp);
};

const normalizeDecimalInput = (input: string) =>
  input.trim().replace(",", ".");

const parseDecimalToScaledInt = (
  input: string,
  scale: number
): FxRateParseResult => {
  const normalized = normalizeDecimalInput(input);
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { error: { key: "transactions.fxRateInvalid" } };
  }

  const parts = normalized.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  if (decimalPart.length > scale) {
    return { error: { key: "transactions.fxRateInvalid" } };
  }

  const paddedDecimals = decimalPart.padEnd(scale, "0");
  return BigInt(integerPart + paddedDecimals);
};

const divideAndRoundHalfUp = (numerator: bigint, denominator: bigint) => {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) return quotient + 1n;
  return quotient;
};

/**
 * Parse a money string to minor units (bigint)
 * Examples:
 *   "12.30" EUR -> 1230n
 *   "1200" JPY -> 1200n
 *   "1.234" KWD -> 1234n
 *
 * Accepts both comma and dot as decimal separator
 * Validates that decimals don't exceed currency's minor units
 */
export function parseMoneyToMinor(
  input: string,
  currency: string,
  currencyMeta: CurrencyMeta = CURRENCY_MINOR_UNITS
): MoneyParseResult {
  if (!input || input.trim() === "") {
    return { error: { key: "money.amountRequired" } };
  }

  // Replace comma with dot for parsing
  const normalized = normalizeDecimalInput(input);

  // Check if valid number format
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { error: { key: "money.invalidFormat" } };
  }

  const minorUnits = getMinorUnits(currency, currencyMeta);

  // Split into integer and decimal parts
  const parts = normalized.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  // Validate decimal places
  if (decimalPart.length > minorUnits) {
    return {
      error: {
        key: "money.maxDecimalPlaces",
        params: { currency, count: minorUnits },
      },
    };
  }

  // For currencies with no decimals, reject decimal input
  if (minorUnits === 0 && decimalPart.length > 0) {
    return {
      error: { key: "money.noDecimalPlaces", params: { currency } },
    };
  }

  // Pad decimals to match minor units
  const paddedDecimals = decimalPart.padEnd(minorUnits, "0");

  // Combine integer and decimal parts
  const minorValue = integerPart + paddedDecimals;

  try {
    const result = BigInt(minorValue);
    if (result < 0n) {
      return { error: { key: "money.negativeAmount" } };
    }
    return result;
  } catch (e) {
    return { error: { key: "money.invalidAmount" } };
  }
}

/**
 * Format minor units (bigint) to display string
 * Examples:
 *   1230n EUR -> "12.30"
 *   1200n JPY -> "1200"
 *   1234n KWD -> "1.234"
 */
export function formatMinorToMoney(
  amountMinor: bigint,
  currency: string,
  currencyMeta: CurrencyMeta = CURRENCY_MINOR_UNITS
): string {
  const minorUnits = getMinorUnits(currency, currencyMeta);

  if (minorUnits === 0) {
    return amountMinor.toString();
  }

  const isNegative = amountMinor < 0n;
  const absolute = isNegative ? -amountMinor : amountMinor;
  const divisor = BigInt(10 ** minorUnits);
  const integerPart = absolute / divisor;
  const decimalPart = absolute % divisor;

  // Pad decimal part with leading zeros
  const decimalStr = decimalPart.toString().padStart(minorUnits, "0");

  return `${isNegative ? "-" : ""}${integerPart}.${decimalStr}`;
}

/**
 * Format minor units with currency symbol
 * Examples:
 *   1230n EUR -> "€12.30"
 *   1200n JPY -> "¥1200"
 */
export function formatMoneyWithSymbol(
  amountMinor: bigint,
  currency: string,
  currencySymbol: string,
  currencyMeta: CurrencyMeta = CURRENCY_MINOR_UNITS
): string {
  const formatted = formatMinorToMoney(amountMinor, currency, currencyMeta);
  return `${currencySymbol}${formatted}`;
}

export function computeAmountBaseMinor(params: {
  amountMinor: bigint;
  currency: string;
  baseCurrency: string;
  fxRate: string;
  currencyMeta?: CurrencyMeta;
}): FxRateParseResult {
  const { amountMinor, currency, baseCurrency, fxRate, currencyMeta } = params;
  const fromUnits = getMinorUnits(currency, currencyMeta);
  const toUnits = getMinorUnits(baseCurrency, currencyMeta);
  const fxRateScaled = parseDecimalToScaledInt(fxRate, FX_RATE_SCALE);
  if (typeof fxRateScaled === "object" && "error" in fxRateScaled) {
    return fxRateScaled;
  }

  if (fxRateScaled <= 0n) {
    return { error: { key: "transactions.fxRateInvalid" } };
  }

  let numerator = amountMinor * fxRateScaled;
  let denominator = pow10BigInt(FX_RATE_SCALE);
  const unitsDiff = toUnits - fromUnits;

  if (unitsDiff > 0) {
    numerator *= pow10BigInt(unitsDiff);
  } else if (unitsDiff < 0) {
    denominator *= pow10BigInt(-unitsDiff);
  }

  return divideAndRoundHalfUp(numerator, denominator);
}

export function parseFxRate(input: string): FxRateParseResult {
  return parseDecimalToScaledInt(input, FX_RATE_SCALE);
}

/**
 * Convert amount from one currency to another using FX rate
 * Convention: 1 unit of fromCurrency = fxRate units of toCurrency
 *
 * Example: Convert 100 USD to EUR with rate "0.91"
 *   10000n (100.00 USD) -> 9100n (91.00 EUR)
 */
export function convertCurrency(
  amountMinor: bigint,
  fromCurrency: string,
  toCurrency: string,
  fxRate: string,
  currencyMeta: CurrencyMeta = CURRENCY_MINOR_UNITS
): FxRateParseResult {
  return computeAmountBaseMinor({
    amountMinor,
    currency: fromCurrency,
    baseCurrency: toCurrency,
    fxRate,
    currencyMeta,
  });
}
