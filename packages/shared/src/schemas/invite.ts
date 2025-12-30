import { z } from "zod";

// Database schema (matches invites table structure)
export const inviteSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  token_hash: z.string(),
  role: z.enum(["viewer", "contributor", "admin"]),
  expires_at: z.coerce.date(),
  revoked_at: z.coerce.date().nullable(),
  max_uses: z.number().int().positive().nullable(),
  uses_count: z.number().int().nonnegative(),
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
});

// API request schemas
export const createInviteSchema = z.object({
  accountId: z.string().uuid(),
  role: z.enum(["viewer", "contributor", "admin"]),
  expiresInHours: z.number().int().positive().max(8760), // Max 1 year (365 days * 24 hours)
  maxUses: z.number().int().positive().optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(40), // Base64-encoded 32 bytes ≈ 44 chars
});

// API response schemas
export const createInviteResponseSchema = z.object({
  inviteUrl: z.string().url(),
  expiresAt: z.coerce.date(),
  role: z.enum(["viewer", "contributor", "admin"]),
});

export const acceptInviteResponseSchema = z.object({
  accountId: z.string().uuid(),
  role: z.enum(["viewer", "contributor", "admin"]),
});

// Types
export type Invite = z.infer<typeof inviteSchema>;
export type CreateInviteRequest = z.infer<typeof createInviteSchema>;
export type AcceptInviteRequest = z.infer<typeof acceptInviteSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;
