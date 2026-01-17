import type { CategoryType } from "../schemas/category";

/**
 * A category returned by the get_top_categories RPC.
 * Contains minimal data needed for display in the selector.
 */
export interface TopCategory {
  id: string;
  name: string;
  icon_id: string;
  type: CategoryType;
}

/**
 * Response from the get_top_categories RPC function.
 */
export type TopCategoriesResponse = TopCategory[];

/**
 * Cache key generator for top categories.
 * Use this to create consistent cache keys across platforms.
 */
export function getTopCategoriesCacheKey(
  accountId: string,
  txType: CategoryType
): string {
  return `top_categories:${accountId}:${txType}`;
}
