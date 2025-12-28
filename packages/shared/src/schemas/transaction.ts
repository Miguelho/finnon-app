import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  type: transactionTypeSchema,
  amount_minor: z.bigint(),
  currency: z.string().length(3),
  amount_base_minor: z.bigint(),
  category_id: z.string().uuid().nullable(),
  date: z.date(),
  merchant: z.string().max(255).nullable(),
  notes: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.date(),
});

export const createTransactionSchema = transactionSchema.omit({
  id: true,
  created_at: true,
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
