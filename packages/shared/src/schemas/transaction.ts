import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense"]);
export const transactionSplitTypeSchema = z.enum(["equal", "personal", "custom"]);

export const transactionSplitDetailSchema = z.object({
  user_id: z.string().uuid(),
  share_minor: z.number().int().nonnegative(),
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  type: transactionTypeSchema,
  amount_minor: z.bigint(),
  currency: z.string().length(3),
  amount_base_minor: z.bigint(),
  fx_rate: z.string(),
  fx_date: z.date(),
  category_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable().optional(),
  obligation_id: z.string().uuid().nullable().optional(),
  date: z.date(),
  merchant: z.string().max(255).nullable(),
  notes: z.string().nullable(),
  created_by: z.string().uuid(),
  paid_by: z.string().uuid(),
  split_type: transactionSplitTypeSchema,
  split_details: z.array(transactionSplitDetailSchema).nullable().optional(),
  created_at: z.date(),
});

export const createTransactionSchema = transactionSchema.omit({
  id: true,
  created_at: true,
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionSplitType = z.infer<typeof transactionSplitTypeSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
