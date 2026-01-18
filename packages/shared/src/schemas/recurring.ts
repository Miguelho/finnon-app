import { z } from "zod";

export const recurringFrequencySchema = z.enum(["weekly", "monthly", "yearly"]);

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format",
});

export const updateRecurringItemSchema = z.object({
  id: z.string().uuid(),
  merchant: z.string().min(1).max(255).optional(),
  amount_minor: z.number().int().positive().optional(),
  start_date: dateStringSchema.optional(),
  end_date: dateStringSchema.nullable().optional(),
  effective_from: dateStringSchema,
});

export const pauseRecurringItemSchema = z.object({
  id: z.string().uuid(),
  is_paused: z.boolean(),
});

export const endRecurringItemSchema = z.object({
  id: z.string().uuid(),
  end_date: dateStringSchema,
});

// RecurringFrequency type is already exported from ../recurring/recurring.ts
export type UpdateRecurringItem = z.infer<typeof updateRecurringItemSchema>;
export type PauseRecurringItem = z.infer<typeof pauseRecurringItemSchema>;
export type EndRecurringItem = z.infer<typeof endRecurringItemSchema>;
