import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryCreateInputSchema,
  categoryUpdateInputSchema,
  normalizeCategoryName,
} from "./category";

const baseInput = {
  account_id: "11111111-1111-1111-1111-111111111111",
  icon_id: "general",
  type: "expense" as const,
};

test("normalizeCategoryName trims and collapses whitespace", () => {
  assert.equal(normalizeCategoryName("  Home   bills  "), "Home bills");
});

test("categoryCreateInputSchema normalizes names", () => {
  const parsed = categoryCreateInputSchema.parse({
    ...baseInput,
    name: "  Groceries   &   markets ",
  });
  assert.equal(parsed.name, "Groceries & markets");
});

test("categoryCreateInputSchema enforces name length", () => {
  assert.throws(() =>
    categoryCreateInputSchema.parse({ ...baseInput, name: "A" })
  );
  assert.throws(() =>
    categoryCreateInputSchema.parse({
      ...baseInput,
      name: "A".repeat(41),
    })
  );
});

test("categoryUpdateInputSchema enforces name length", () => {
  assert.throws(() =>
    categoryUpdateInputSchema.parse({
      name: "A",
      icon_id: "general",
      type: "income",
    })
  );
});
