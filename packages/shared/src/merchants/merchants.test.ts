import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMerchant,
  filterMerchantSuggestions,
  getMerchantSuggestionsCacheKey,
  isExactMerchantMatch,
  type MerchantSuggestion,
} from "./index";

describe("normalizeMerchant", () => {
  test("trims leading and trailing whitespace", () => {
    assert.equal(normalizeMerchant("  Starbucks  "), "starbucks");
    assert.equal(normalizeMerchant("\tNetflix\n"), "netflix");
  });

  test("collapses multiple spaces to single space", () => {
    assert.equal(normalizeMerchant("Burger   King"), "burger king");
    assert.equal(normalizeMerchant("El    Corte   Inglés"), "el corte inglés");
  });

  test("converts to lowercase", () => {
    assert.equal(normalizeMerchant("NETFLIX"), "netflix");
    assert.equal(normalizeMerchant("Netflix"), "netflix");
    assert.equal(normalizeMerchant("MERCADONA"), "mercadona");
  });

  test("handles combined transformations", () => {
    assert.equal(normalizeMerchant("  BURGER   King  "), "burger king");
    assert.equal(normalizeMerchant(" Mercadona "), "mercadona");
  });

  test("handles empty string", () => {
    assert.equal(normalizeMerchant(""), "");
    assert.equal(normalizeMerchant("   "), "");
  });
});

describe("filterMerchantSuggestions", () => {
  const suggestions: MerchantSuggestion[] = [
    { merchant: "Starbucks", normalized: "starbucks", frequency: 5, lastUsed: "2024-01-10" },
    { merchant: "Netflix", normalized: "netflix", frequency: 3, lastUsed: "2024-01-08" },
    { merchant: "Star Wars Shop", normalized: "star wars shop", frequency: 1, lastUsed: "2024-01-05" },
    { merchant: "Amazon", normalized: "amazon", frequency: 10, lastUsed: "2024-01-12" },
    { merchant: "Mercadona", normalized: "mercadona", frequency: 15, lastUsed: "2024-01-11" },
  ];

  test("returns all suggestions on empty query", () => {
    const filtered = filterMerchantSuggestions(suggestions, "");
    assert.equal(filtered.length, 5);
  });

  test("returns all suggestions on whitespace-only query", () => {
    const filtered = filterMerchantSuggestions(suggestions, "   ");
    assert.equal(filtered.length, 5);
  });

  test("filters by prefix (case-insensitive)", () => {
    const filtered = filterMerchantSuggestions(suggestions, "star");
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].merchant, "Starbucks");
    assert.equal(filtered[1].merchant, "Star Wars Shop");
  });

  test("filters by contains when no prefix match", () => {
    const filtered = filterMerchantSuggestions(suggestions, "war");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].merchant, "Star Wars Shop");
  });

  test("prioritizes prefix matches over contains matches", () => {
    // "ama" is prefix of "amazon" and contains in no others
    const filtered = filterMerchantSuggestions(suggestions, "ama");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].merchant, "Amazon");
  });

  test("handles query with different casing", () => {
    const filtered = filterMerchantSuggestions(suggestions, "NETFLIX");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].merchant, "Netflix");
  });

  test("returns empty array when no matches", () => {
    const filtered = filterMerchantSuggestions(suggestions, "xyz");
    assert.equal(filtered.length, 0);
  });

  test("handles query with extra spaces", () => {
    const filtered = filterMerchantSuggestions(suggestions, "  mer  ");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].merchant, "Mercadona");
  });
});

describe("getMerchantSuggestionsCacheKey", () => {
  test("generates consistent cache keys", () => {
    const key1 = getMerchantSuggestionsCacheKey("abc-123", "expense");
    const key2 = getMerchantSuggestionsCacheKey("abc-123", "expense");
    assert.equal(key1, key2);
  });

  test("generates correct format", () => {
    const key = getMerchantSuggestionsCacheKey("account-uuid-here", "expense");
    assert.equal(key, "merchant_suggestions:account-uuid-here:expense");
  });

  test("different accounts have different keys", () => {
    const key1 = getMerchantSuggestionsCacheKey("account-1", "expense");
    const key2 = getMerchantSuggestionsCacheKey("account-2", "expense");
    assert.notEqual(key1, key2);
  });

  test("different transaction types have different keys", () => {
    const key1 = getMerchantSuggestionsCacheKey("account-1", "expense");
    const key2 = getMerchantSuggestionsCacheKey("account-1", "income");
    assert.notEqual(key1, key2);
  });
});

describe("isExactMerchantMatch", () => {
  const suggestions: MerchantSuggestion[] = [
    { merchant: "Starbucks", normalized: "starbucks", frequency: 5, lastUsed: "2024-01-10" },
    { merchant: "Burger King", normalized: "burger king", frequency: 3, lastUsed: "2024-01-08" },
  ];

  test("finds exact match regardless of case", () => {
    assert.equal(isExactMerchantMatch("STARBUCKS", suggestions), true);
    assert.equal(isExactMerchantMatch("starbucks", suggestions), true);
    assert.equal(isExactMerchantMatch("Starbucks", suggestions), true);
  });

  test("finds exact match with trimmed whitespace", () => {
    assert.equal(isExactMerchantMatch("  starbucks  ", suggestions), true);
  });

  test("finds exact match with collapsed spaces", () => {
    assert.equal(isExactMerchantMatch("Burger   King", suggestions), true);
  });

  test("returns false for partial matches", () => {
    assert.equal(isExactMerchantMatch("Starbuck", suggestions), false);
    assert.equal(isExactMerchantMatch("Star", suggestions), false);
  });

  test("returns false for non-existent merchants", () => {
    assert.equal(isExactMerchantMatch("McDonalds", suggestions), false);
  });

  test("handles empty suggestions array", () => {
    assert.equal(isExactMerchantMatch("Starbucks", []), false);
  });
});
