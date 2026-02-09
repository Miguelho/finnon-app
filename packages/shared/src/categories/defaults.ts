import { type CategoryIconKey } from "../icons/category-icons";
import { normalizeCategoryName, type CategoryType } from "../schemas/category";

export type DefaultCategory = {
  name: string;
  name_en: string;
  icon_id: CategoryIconKey;
  type: CategoryType;
  preselected: boolean;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Gastos - preseleccionados
  {
    name: "Hogar",
    name_en: "Home",
    icon_id: "House",
    type: "expense",
    preselected: true,
  },
  {
    name: "Transporte",
    name_en: "Transport",
    icon_id: "Car",
    type: "expense",
    preselected: true,
  },
  {
    name: "Alimentación",
    name_en: "Groceries",
    icon_id: "ShoppingCart",
    type: "expense",
    preselected: true,
  },
  {
    name: "Restaurantes",
    name_en: "Restaurants",
    icon_id: "ForkKnife",
    type: "expense",
    preselected: true,
  },
  {
    name: "Suscripciones",
    name_en: "Subscriptions",
    icon_id: "Monitor",
    type: "expense",
    preselected: true,
  },
  {
    name: "Suministros",
    name_en: "Utilities",
    icon_id: "Plug",
    type: "expense",
    preselected: true,
  },
  // Gastos - no preseleccionados
  {
    name: "Salud",
    name_en: "Health",
    icon_id: "FirstAidKit",
    type: "expense",
    preselected: false,
  },
  {
    name: "Ocio",
    name_en: "Leisure",
    icon_id: "GameController",
    type: "expense",
    preselected: false,
  },
  {
    name: "Ropa",
    name_en: "Clothing",
    icon_id: "TShirt",
    type: "expense",
    preselected: false,
  },
  {
    name: "Mascotas",
    name_en: "Pets",
    icon_id: "PawPrint",
    type: "expense",
    preselected: false,
  },
  // Ingresos
  {
    name: "Nómina",
    name_en: "Salary",
    icon_id: "Briefcase",
    type: "income",
    preselected: true,
  },
];

export type CategorySeedClient = {
  from: (table: string) => any;
};

const normalizeSeedName = (value: string) =>
  normalizeCategoryName(value).toLowerCase();

export async function seedDefaultCategories(
  client: CategorySeedClient,
  accountId: string,
  locale: "es" | "en" = "es"
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

  const toInsert = DEFAULT_CATEGORIES.filter((category) => {
    const localizedName = locale === "en" ? category.name_en : category.name;
    return !existingNames.has(normalizeSeedName(localizedName));
  });

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: DEFAULT_CATEGORIES.length };
  }

  const { error: insertError } = await client.from("categories").insert(
    toInsert.map((category) => ({
      account_id: accountId,
      name: locale === "en" ? category.name_en : category.name,
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
