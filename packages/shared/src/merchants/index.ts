/**
 * Merchant suggestion returned by get_merchant_suggestions RPC.
 * Contains data for autocomplete display and matching.
 */
export interface MerchantSuggestion {
  /** Display form (original casing from most recent usage) */
  merchant: string;
  /** Normalized form for comparison (lowercase, trimmed, collapsed spaces) */
  normalized: string;
  /** Number of times this merchant appears in the window */
  frequency: number;
  /** ISO date of most recent transaction with this merchant */
  lastUsed: string;
}

/**
 * Response type from the get_merchant_suggestions RPC function.
 */
export type MerchantSuggestionsResponse = MerchantSuggestion[];

/**
 * Normalize merchant string for comparison.
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces to single space
 * - Converts to lowercase
 *
 * Must match the SQL normalization in get_merchant_suggestions RPC.
 */
export function normalizeMerchant(merchant: string): string {
  return merchant
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Filter suggestions by search query.
 * Uses case-insensitive matching against normalized merchant.
 * Matches both prefix and contains for flexibility.
 *
 * @param suggestions - Array of merchant suggestions to filter
 * @param query - User's search input
 * @returns Filtered suggestions (maintains original order from server)
 */
export function filterMerchantSuggestions(
  suggestions: MerchantSuggestion[],
  query: string
): MerchantSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return suggestions;

  const normalizedQuery = normalizeMerchant(trimmed);

  // Prioritize prefix matches, then contains
  const prefixMatches: MerchantSuggestion[] = [];
  const containsMatches: MerchantSuggestion[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.normalized.startsWith(normalizedQuery)) {
      prefixMatches.push(suggestion);
    } else if (suggestion.normalized.includes(normalizedQuery)) {
      containsMatches.push(suggestion);
    }
  }

  return [...prefixMatches, ...containsMatches];
}

/**
 * Cache key generator for merchant suggestions.
 * Use this to create consistent cache keys across platforms.
 */
export function getMerchantSuggestionsCacheKey(
  accountId: string,
  txType: "income" | "expense"
): string {
  return `merchant_suggestions:${accountId}:${txType}`;
}

/**
 * Check if a merchant string matches any suggestion exactly (normalized).
 * Useful for determining if user input is an existing merchant.
 */
export function isExactMerchantMatch(
  merchant: string,
  suggestions: MerchantSuggestion[]
): boolean {
  const normalized = normalizeMerchant(merchant);
  return suggestions.some((s) => s.normalized === normalized);
}
