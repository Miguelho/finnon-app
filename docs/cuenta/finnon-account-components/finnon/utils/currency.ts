/**
 * Formatea un número como moneda.
 *
 * formatCurrency(14334.48) → { whole: "14.334", cents: ",48", sign: "" }
 * formatCurrency(-850) → { whole: "850", cents: ",00", sign: "-" }
 *
 * Se devuelve desglosado para que el UI pueda dar distinto estilo
 * a la parte entera y a los céntimos (ej: céntimos más pequeños/grises).
 */

interface FormattedCurrency {
  whole: string;
  cents: string;
  sign: '+' | '-' | '';
  full: string;
}

export function formatCurrency(
  amount: number,
  options?: { showSign?: boolean; currency?: string }
): FormattedCurrency {
  const { showSign = false, currency = '€' } = options ?? {};

  const abs = Math.abs(amount);
  const sign = amount > 0 && showSign ? '+' : amount < 0 ? '-' : '';

  // Formato europeo: punto como separador de miles, coma para decimales
  const parts = abs.toFixed(2).split('.');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = `,${parts[1]}`;

  return {
    whole,
    cents,
    sign,
    full: `${sign}${currency}${whole}${cents}`,
  };
}

/**
 * Formatea un delta porcentual.
 * formatDelta(2.3) → "+2,3%"
 * formatDelta(-8.1) → "-8,1%"
 * formatDelta(null) → null
 */
export function formatDelta(delta: number | null): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1).replace('.', ',')}%`;
}
