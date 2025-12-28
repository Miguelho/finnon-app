import { z } from "zod";

export const categoryTypeSchema = z.enum(["income", "expense"]);

export const categorySchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  icon_id: z.string().min(1),
  type: categoryTypeSchema,
  created_at: z.date(),
});

export const createCategorySchema = categorySchema.omit({
  id: true,
  created_at: true,
});

export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
