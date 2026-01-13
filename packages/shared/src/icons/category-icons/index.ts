export const CATEGORY_ICON_KEYS = [
  "House",
  "ShoppingCart",
  "ForkKnife",
  "Car",
  "Bus",
  "Train",
  "Airplane",
  "Ticket",
  "GasPump",
  "CreditCard",
  "Wallet",
  "Receipt",
  "PiggyBank",
  "Bank",
  "Heart",
  "FirstAidKit",
  "Pill",
  "Stethoscope",
  "GraduationCap",
  "BookOpen",
  "GameController",
  "FilmSlate",
  "MusicNotes",
  "Basketball",
  "Barbell",
  "TShirt",
  "Handbag",
  "Tag",
  "Gift",
  "PawPrint",
  "Leaf",
  "Tree",
  "Lightbulb",
  "Plug",
  "WifiHigh",
  "Phone",
  "Laptop",
  "Monitor",
  "Camera",
  "Wrench",
  "Gear",
  "Hammer",
  "Scissors",
  "Broom",
  "Bed",
  "Couch",
  "Storefront",
  "Buildings",
  "Briefcase",
  "UsersThree",
] as const;

export const CATEGORY_ICON_SET = CATEGORY_ICON_KEYS;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return (
    typeof value === "string" &&
    CATEGORY_ICON_KEYS.includes(value as CategoryIconKey)
  );
}
