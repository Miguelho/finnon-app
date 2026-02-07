/**
 * Utility functions for Finnon components
 */

/**
 * Formats a number into integer and decimal parts for display.
 * Uses European format: dot as thousands separator, comma as decimal.
 *
 * Examples:
 *   formatCurrency(-1558.36) → { integer: "-€1.558", decimals: "36" }
 *   formatCurrency(13.86)    → { integer: "€13", decimals: "86" }
 */
export function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100)
    .toString()
    .padStart(2, "0");

  // Format integer with dots as thousands separator
  const intFormatted = intPart.toLocaleString("es-ES");

  return {
    integer: `${sign}€${intFormatted}`,
    decimals: decPart,
    full: `${sign}€${intFormatted},${decPart}`,
  };
}

/**
 * Formats a date into short Spanish format.
 * Example: new Date("2026-02-03") → "3 feb"
 */
export function formatShortDate(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/**
 * Formats a date into full Spanish format.
 * Example: new Date("2026-02-05") → "Miércoles 5 de febrero"
 */
export function formatFullDate(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const days = [
    "Domingo", "Lunes", "Martes", "Miércoles",
    "Jueves", "Viernes", "Sábado",
  ];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}
