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

const formatThousands = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function formatCurrencyParts(
  amountMinor: bigint,
  currencySymbol: string
): MoneyParts {
  const sign = amountMinor < 0n ? "-" : "";
  const abs = amountMinor < 0n ? -amountMinor : amountMinor;
  const intPart = abs / 100n;
  const decPart = abs % 100n;
  const integer = `${sign}${currencySymbol}${formatThousands(intPart.toString())}`;
  const decimals = decPart.toString().padStart(2, "0");
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
  const months: Record<string, string[]> = {
    en: [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ],
    es: [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ],
  };
  const monthLabels = months[locale] ?? months.es;
  return `${d.getDate()} ${monthLabels[d.getMonth()] ?? ""}`.trim();
}

export function formatFullDate(date: Date | string, locale: string = "es"): string {
  const d = parseDateValue(date);
  if (Number.isNaN(d.getTime())) return "";
  const days: Record<string, string[]> = {
    en: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  };
  const months: Record<string, string[]> = {
    en: [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ],
    es: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
  };
  const dayLabels = days[locale] ?? days.es;
  const monthLabels = months[locale] ?? months.es;
  if (locale === "en") {
    return `${dayLabels[d.getDay()] ?? ""} ${monthLabels[d.getMonth()] ?? ""} ${
      d.getDate()
    }`.trim();
  }
  return `${dayLabels[d.getDay()] ?? ""} ${d.getDate()} de ${
    monthLabels[d.getMonth()] ?? ""
  }`.trim();
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
