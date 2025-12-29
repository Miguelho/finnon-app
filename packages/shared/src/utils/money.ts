/**
 * Money utilities for handling amounts in minor units (cents)
 * to avoid floating point errors
 */

// Currency minor units (decimal places)
// Based on ISO 4217 standard
export const CURRENCY_MINOR_UNITS: Record<string, number> = {
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
export function getMinorUnits(currency: string): number {
  return CURRENCY_MINOR_UNITS[currency] ?? 2;
}

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
  currency: string
): bigint | { error: string } {
  if (!input || input.trim() === "") {
    return { error: "Amount is required" };
  }

  // Replace comma with dot for parsing
  const normalized = input.trim().replace(",", ".");

  // Check if valid number format
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { error: "Invalid amount format" };
  }

  const minorUnits = getMinorUnits(currency);

  // Split into integer and decimal parts
  const parts = normalized.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  // Validate decimal places
  if (decimalPart.length > minorUnits) {
    return {
      error: `${currency} supports maximum ${minorUnits} decimal places`,
    };
  }

  // For currencies with no decimals, reject decimal input
  if (minorUnits === 0 && decimalPart.length > 0) {
    return { error: `${currency} does not support decimal places` };
  }

  // Pad decimals to match minor units
  const paddedDecimals = decimalPart.padEnd(minorUnits, "0");

  // Combine integer and decimal parts
  const minorValue = integerPart + paddedDecimals;

  try {
    const result = BigInt(minorValue);
    if (result < 0n) {
      return { error: "Amount cannot be negative" };
    }
    return result;
  } catch (e) {
    return { error: "Invalid amount" };
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
  currency: string
): string {
  const minorUnits = getMinorUnits(currency);

  if (minorUnits === 0) {
    return amountMinor.toString();
  }

  const divisor = BigInt(10 ** minorUnits);
  const integerPart = amountMinor / divisor;
  const decimalPart = amountMinor % divisor;

  // Pad decimal part with leading zeros
  const decimalStr = decimalPart.toString().padStart(minorUnits, "0");

  return `${integerPart}.${decimalStr}`;
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
  currencySymbol: string
): string {
  const formatted = formatMinorToMoney(amountMinor, currency);
  return `${currencySymbol}${formatted}`;
}

/**
 * Convert amount from one currency to another using FX rate
 * Convention: 1 unit of fromCurrency = fxRate units of toCurrency
 *
 * Example: Convert 100 USD to EUR with rate 0.91
 *   10000n (100.00 USD) -> 9100n (91.00 EUR)
 */
export function convertCurrency(
  amountMinor: bigint,
  fromCurrency: string,
  toCurrency: string,
  fxRate: number
): bigint {
  const fromMinorUnits = getMinorUnits(fromCurrency);
  const toMinorUnits = getMinorUnits(toCurrency);

  // Convert to major units (as number for calculation)
  const amountMajor = Number(amountMinor) / 10 ** fromMinorUnits;

  // Apply FX rate
  const convertedMajor = amountMajor * fxRate;

  // Convert back to minor units and round (HALF_UP)
  const convertedMinor = Math.round(convertedMajor * 10 ** toMinorUnits);

  return BigInt(convertedMinor);
}
