const HEX_COLOR_6 = /^#[0-9A-F]{6}$/i;
const HEX_COLOR_3 = /^#[0-9A-F]{3}$/i;

export const CATEGORY_PALETTE = [
  "#D4943A",
  "#CB6E55",
  "#9B85D6",
  "#52B3A3",
  "#D47A95",
  "#6AADDB",
  "#B8A054",
  "#A0887A",
] as const;

export type CategoryColorValue = (typeof CATEGORY_PALETTE)[number] | string;

export const isHexColor = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") return false;
  return HEX_COLOR_6.test(value) || HEX_COLOR_3.test(value);
};

export const normalizeHexColor = (
  value: string | null | undefined
): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (HEX_COLOR_6.test(normalized)) return normalized;
  if (!HEX_COLOR_3.test(normalized)) return null;

  const [_, a, b, c] = normalized.split("");
  return `#${a}${a}${b}${b}${c}${c}`;
};

type CategoryColorLike = {
  color?: string | null;
};

/**
 * Picks the next category color using the defined palette.
 * Prefers the first unused color; if all are used, cycles by index.
 */
export function assignCategoryColor(existingCategories: CategoryColorLike[]): string {
  const used = new Set(
    existingCategories
      .map((category) => normalizeHexColor(category.color))
      .filter((color): color is string => Boolean(color))
  );

  const available = CATEGORY_PALETTE.find((color) => !used.has(color));
  if (available) return available;

  return CATEGORY_PALETTE[existingCategories.length % CATEGORY_PALETTE.length]!;
}
