export type MoneyParts = {
  integer: string;
  decimals: string;
  full: string;
};

export const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
};

export function formatCurrencyParts(
  amountMinor: bigint,
  currencySymbol: string,
  locale: string = "es-ES"
): MoneyParts {
  const sign = amountMinor < 0n ? "-" : "";
  const abs = amountMinor < 0n ? -amountMinor : amountMinor;
  const intPart = abs / 100n;
  const decPart = abs % 100n;
  const intFormatted = new Intl.NumberFormat(locale).format(Number(intPart));
  const decimals = decPart.toString().padStart(2, "0");
  const integer = `${sign}${currencySymbol}${intFormatted}`;
  return {
    integer,
    decimals,
    full: `${integer},${decimals}`,
  };
}

const parseDateValue = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
};

export function formatShortDate(date: Date | string, locale: string = "es"): string {
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  })
    .format(d)
    .replace(",", "")
    .replace(/\.$/, "");
}

export function formatFullDate(date: Date | string, locale: string = "es"): string {
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function toDateKey(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
