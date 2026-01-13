import { z } from "zod";
import { CATEGORY_ICON_KEYS } from "../icons/category-icons";
import { resolveCategoryIconKey } from "../icons/category-icons/legacy";

export const normalizeCategoryName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const categoryNameSchema = z
  .string()
  .transform((value) => normalizeCategoryName(value))
  .pipe(z.string().min(2).max(40));

export const categoryTypeSchema = z.enum(["income", "expense"]);
const categoryIconKeySchema = z.enum(CATEGORY_ICON_KEYS);
const categoryIconKeyCompatSchema = z
  .string()
  .min(1)
  .transform((value) => resolveCategoryIconKey(value));

export const categorySchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  icon_id: categoryIconKeyCompatSchema,
  type: categoryTypeSchema,
  created_at: z.union([z.string().datetime(), z.date()]),
});

export const categoryCreateInputSchema = z.object({
  account_id: z.string().uuid(),
  name: categoryNameSchema,
  icon_id: categoryIconKeySchema,
  type: categoryTypeSchema,
});

export const categoryUpdateInputSchema = z.object({
  name: categoryNameSchema,
  icon_id: categoryIconKeySchema,
  type: categoryTypeSchema,
});

export const createCategorySchema = categoryCreateInputSchema;
export const updateCategorySchema = categoryUpdateInputSchema;

export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInputSchema>;
