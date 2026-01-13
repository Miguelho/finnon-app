import { type CategoryIconKey, CATEGORY_ICON_KEYS } from "./index";

export type IconSuggestedFor = "income" | "expense" | "both";

export type CategoryIconMetadata = {
  key: CategoryIconKey;
  suggestedFor: IconSuggestedFor;
};

export const CATEGORY_ICON_METADATA: CategoryIconMetadata[] = [
  // Housing & Home
  { key: "House", suggestedFor: "expense" },
  { key: "Bed", suggestedFor: "expense" },
  { key: "Couch", suggestedFor: "expense" },
  { key: "Broom", suggestedFor: "expense" },

  // Shopping & Retail
  { key: "ShoppingCart", suggestedFor: "expense" },
  { key: "Storefront", suggestedFor: "both" },
  { key: "Handbag", suggestedFor: "expense" },
  { key: "TShirt", suggestedFor: "expense" },
  { key: "Tag", suggestedFor: "both" },
  { key: "Gift", suggestedFor: "both" },

  // Food & Dining
  { key: "ForkKnife", suggestedFor: "expense" },

  // Transportation
  { key: "Car", suggestedFor: "expense" },
  { key: "Bus", suggestedFor: "expense" },
  { key: "Train", suggestedFor: "expense" },
  { key: "Airplane", suggestedFor: "expense" },
  { key: "Ticket", suggestedFor: "expense" },
  { key: "GasPump", suggestedFor: "expense" },

  // Finance & Banking
  { key: "CreditCard", suggestedFor: "both" },
  { key: "Wallet", suggestedFor: "both" },
  { key: "Receipt", suggestedFor: "expense" },
  { key: "PiggyBank", suggestedFor: "income" },
  { key: "Bank", suggestedFor: "both" },

  // Health & Wellness
  { key: "Heart", suggestedFor: "expense" },
  { key: "FirstAidKit", suggestedFor: "expense" },
  { key: "Pill", suggestedFor: "expense" },
  { key: "Stethoscope", suggestedFor: "expense" },
  { key: "Barbell", suggestedFor: "expense" },

  // Education
  { key: "GraduationCap", suggestedFor: "expense" },
  { key: "BookOpen", suggestedFor: "expense" },

  // Entertainment
  { key: "GameController", suggestedFor: "expense" },
  { key: "FilmSlate", suggestedFor: "expense" },
  { key: "MusicNotes", suggestedFor: "expense" },
  { key: "Basketball", suggestedFor: "expense" },

  // Nature & Pets
  { key: "PawPrint", suggestedFor: "expense" },
  { key: "Leaf", suggestedFor: "expense" },
  { key: "Tree", suggestedFor: "expense" },

  // Utilities & Tech
  { key: "Lightbulb", suggestedFor: "expense" },
  { key: "Plug", suggestedFor: "expense" },
  { key: "WifiHigh", suggestedFor: "expense" },
  { key: "Phone", suggestedFor: "expense" },
  { key: "Laptop", suggestedFor: "expense" },
  { key: "Monitor", suggestedFor: "expense" },
  { key: "Camera", suggestedFor: "expense" },

  // Tools & Maintenance
  { key: "Wrench", suggestedFor: "expense" },
  { key: "Gear", suggestedFor: "both" },
  { key: "Hammer", suggestedFor: "expense" },
  { key: "Scissors", suggestedFor: "expense" },

  // Work & Business
  { key: "Buildings", suggestedFor: "both" },
  { key: "Briefcase", suggestedFor: "income" },
  { key: "UsersThree", suggestedFor: "both" },
];

const metadataByKey = new Map<CategoryIconKey, CategoryIconMetadata>(
  CATEGORY_ICON_METADATA.map((m) => [m.key, m])
);

export function getIconMetadata(
  key: CategoryIconKey
): CategoryIconMetadata | undefined {
  return metadataByKey.get(key);
}

export function getIconsByType(
  type: "income" | "expense"
): readonly CategoryIconKey[] {
  return CATEGORY_ICON_KEYS.filter((key) => {
    const meta = metadataByKey.get(key);
    return meta?.suggestedFor === type || meta?.suggestedFor === "both";
  });
}

export function getAllIconKeys(): readonly CategoryIconKey[] {
  return CATEGORY_ICON_KEYS;
}
