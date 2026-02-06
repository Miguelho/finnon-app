export type FormattedCurrency = {
  whole: string;
  cents: string;
  sign: "+" | "-" | "";
  full: string;
};

export function formatCurrency(
  amount: number,
  options?: { showSign?: boolean; currency?: string; decimals?: number }
): FormattedCurrency {
  const { showSign = false, currency = "€", decimals = 2 } = options ?? {};
  const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 2;
  const abs = Math.abs(amount);
  const sign = amount > 0 && showSign ? "+" : amount < 0 ? "-" : "";

  const parts = abs.toFixed(safeDecimals).split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = safeDecimals > 0 ? `,${parts[1]}` : "";

  return {
    whole,
    cents,
    sign,
    full: `${sign}${currency}${whole}${cents}`,
  };
}

export function formatDelta(delta: number | null): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1).replace(".", ",")}%`;
}

export function getCategoryColorKey(name: string, iconId?: string | null) {
  const normalized = name.toLowerCase();
  if (normalized.includes("casa") || iconId === "House") return "casa";
  if (normalized.includes("famil") || iconId === "UsersThree") return "familia";
  if (
    normalized.includes("ocio") ||
    ["GameController", "FilmSlate", "MusicNotes", "Basketball", "Barbell"].includes(
      iconId ?? ""
    )
  ) {
    return "ocio";
  }
  if (normalized.includes("restaur") || iconId === "ForkKnife") return "restaurantes";
  if (
    normalized.includes("inter") ||
    ["PiggyBank", "Bank", "Wallet", "Receipt", "CreditCard"].includes(iconId ?? "")
  ) {
    return "interests";
  }
  if (normalized.includes("loter") || iconId === "Ticket") return "lottery";
  return "default";
}
