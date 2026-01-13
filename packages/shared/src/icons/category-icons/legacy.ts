import { type CategoryIconKey, isCategoryIconKey } from "./index";

const LEGACY_ICON_MAP: Record<string, CategoryIconKey> = {
  // Legacy id-based keys
  salary: "Briefcase",
  gift: "Gift",
  investment: "PiggyBank",
  refund: "Wallet",
  bonus: "Gift",
  food: "ForkKnife",
  groceries: "ShoppingCart",
  transport: "Car",
  home: "House",
  utilities: "Plug",
  health: "FirstAidKit",
  insurance: "FirstAidKit",
  shopping: "Handbag",
  entertainment: "FilmSlate",
  education: "GraduationCap",
  sports: "Basketball",
  travel: "Airplane",
  coffee: "ForkKnife",
  restaurant: "ForkKnife",
  phone: "Phone",
  internet: "WifiHigh",
  subscription: "Receipt",
  gym: "Barbell",
  beauty: "Scissors",
  other: "Tag",
  general: "Tag",
  cash: "Wallet",
  card: "CreditCard",
  bank: "Bank",
  cart: "ShoppingCart",
  money: "Wallet",
  laptop: "Laptop",

  // Emoji-based legacy icons
  "💰": "Briefcase",
  "🎁": "Gift",
  "📈": "PiggyBank",
  "💵": "Wallet",
  "🎉": "Gift",
  "🍔": "ForkKnife",
  "🛒": "ShoppingCart",
  "🚗": "Car",
  "🏠": "House",
  "💡": "Lightbulb",
  "🏥": "FirstAidKit",
  "🛡️": "FirstAidKit",
  "🛍️": "Handbag",
  "🎬": "FilmSlate",
  "📚": "GraduationCap",
  "⚽": "Basketball",
  "✈️": "Airplane",
  "☕": "ForkKnife",
  "🍽️": "ForkKnife",
  "📱": "Phone",
  "🌐": "WifiHigh",
  "📺": "Receipt",
  "💪": "Barbell",
  "💅": "Scissors",
  "📦": "Tag",
  "⭐": "Tag",
  "💸": "Wallet",
  "💳": "CreditCard",
  "🏦": "Bank",
};

export function resolveCategoryIconKey(
  value?: string | null,
  fallback: CategoryIconKey = "Tag"
): CategoryIconKey {
  if (!value) return fallback;
  if (isCategoryIconKey(value)) return value;

  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (isCategoryIconKey(trimmed)) return trimmed;

  return (
    LEGACY_ICON_MAP[trimmed] ??
    LEGACY_ICON_MAP[trimmed.toLowerCase()] ??
    fallback
  );
}

export function coerceCategoryIconKey(
  value?: string | null
): CategoryIconKey | null {
  if (!value) return null;
  if (isCategoryIconKey(value)) return value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCategoryIconKey(trimmed)) return trimmed;

  return LEGACY_ICON_MAP[trimmed] ?? LEGACY_ICON_MAP[trimmed.toLowerCase()] ?? null;
}
