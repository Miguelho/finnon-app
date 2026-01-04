import { z } from "zod";

export const inviteParticipantSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["viewer", "contributor", "admin"]),
  expiresInHours: z.number().int().positive().max(8760),
  maxUses: z.number().int().positive().optional(),
});

export const inviteParticipantResponseSchema = z.object({
  status: z.enum(["created", "pending", "already_member"]),
  inviteUrl: z.string().url().optional(),
});

export type InviteParticipantRequest = z.infer<typeof inviteParticipantSchema>;
export type InviteParticipantResponse = z.infer<
  typeof inviteParticipantResponseSchema
>;
