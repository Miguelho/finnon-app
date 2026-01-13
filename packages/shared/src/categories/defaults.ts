import { type CategoryIconKey } from "../icons/category-icons";
import { normalizeCategoryName, type CategoryType } from "../schemas/category";

export type DefaultCategory = {
  name: string;
  icon_id: CategoryIconKey;
  type: CategoryType;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Mascotas", icon_id: "PawPrint", type: "expense" },
  { name: "Ocio", icon_id: "GameController", type: "expense" },
  { name: "Familia", icon_id: "UsersThree", type: "expense" },
  { name: "Niños", icon_id: "UsersThree", type: "expense" },
  { name: "Infancia", icon_id: "Gift", type: "expense" },
];

export type CategorySeedClient = {
  from: (table: string) => any;
};

const normalizeSeedName = (value: string) =>
  normalizeCategoryName(value).toLowerCase();

export async function seedDefaultCategories(
  client: CategorySeedClient,
  accountId: string
): Promise<{ inserted: number; skipped: number }> {
  const { data: existing, error: existingError } = await client
    .from("categories")
    .select("id, name")
    .eq("account_id", accountId);

  if (existingError) {
    throw existingError;
  }

  const existingNames = new Set(
    (existing ?? []).map((category: { name: string }) =>
      normalizeSeedName(category.name)
    )
  );

  const toInsert = DEFAULT_CATEGORIES.filter(
    (category) => !existingNames.has(normalizeSeedName(category.name))
  );

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: DEFAULT_CATEGORIES.length };
  }

  const { error: insertError } = await client.from("categories").insert(
    toInsert.map((category) => ({
      account_id: accountId,
      name: category.name,
      icon_id: category.icon_id,
      type: category.type,
    }))
  );

  if (insertError) {
    throw insertError;
  }

  return {
    inserted: toInsert.length,
    skipped: DEFAULT_CATEGORIES.length - toInsert.length,
  };
}
