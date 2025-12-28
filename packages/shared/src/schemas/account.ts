import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  base_currency: z.string().length(3),
  owner_user_id: z.string().uuid(),
  created_at: z.date(),
});

export const createAccountSchema = accountSchema.omit({
  id: true,
  created_at: true,
});

export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
