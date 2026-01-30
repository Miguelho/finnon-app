import { z } from "zod";

export const memberRoleSchema = z.enum(["viewer", "contributor", "admin"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const inviteStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "revoked",
  "expired",
]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

// Database schema (matches invites table structure)
export const inviteSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  token_hash: z.string().optional(),
  role: memberRoleSchema,
  status: inviteStatusSchema.optional(),
  invited_email: z.string().email().nullable().optional(),
  expires_at: z.coerce.date(),
  revoked_at: z.coerce.date().nullable().optional(),
  responded_at: z.coerce.date().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  uses_count: z.number().int().nonnegative().optional(),
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  code: z.string().nullable().optional(),
  code_hash: z.string().nullable().optional(),
  invitee_user_id: z.string().uuid().nullable().optional(),
  invitee_email: z.string().email().nullable().optional(),
});

// API request schemas
export const createInviteSchema = z.object({
  accountId: z.string().uuid(),
  role: memberRoleSchema,
  expiresInHours: z.number().int().positive().max(8760).optional(), // Max 1 year, optional = unlimited
  maxUses: z.number().int().positive().optional(),
  email: z.string().email(), // Email del usuario a invitar (obligatorio)
});

export const acceptInviteSchema = z.object({
  token: z.string().min(40).optional(), // Base64-encoded 32 bytes ≈ 44 chars
  inviteId: z.string().uuid().optional(),
  code: z.string().min(4).optional(),
}).refine(
  (value) => Boolean(value.token || value.inviteId || value.code),
  { message: "token, inviteId, or code is required" }
);

// API response schemas
export const createInviteResponseSchema = z.object({
  inviteUrl: z.string().url(),
  expiresAt: z.coerce.date(),
  role: memberRoleSchema,
});

export const acceptInviteResponseSchema = z.object({
  accountId: z.string().uuid(),
  role: memberRoleSchema,
});

// Types
export type Invite = z.infer<typeof inviteSchema>;
export type CreateInviteRequest = z.infer<typeof createInviteSchema>;
export type AcceptInviteRequest = z.infer<typeof acceptInviteSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;
