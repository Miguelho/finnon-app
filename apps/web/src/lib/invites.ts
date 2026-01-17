import type { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export type InviteLookup = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  status?: string | null;
  expires_at: string;
  revoked_at: string | null;
  max_uses?: number | null;
  uses_count?: number;
  invited_email?: string | null;
  invitee_email?: string | null;
  invitee_user_id?: string | null;
};

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  }

  try {
    const authenticated = await createAuthenticatedClient();
    return { user: authenticated.user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}

export function normalizeEmail(email?: string | null) {
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

export function inviteMatchesUser(invite: InviteLookup, user: { id: string; email?: string | null }) {
  if (invite.invitee_user_id && invite.invitee_user_id !== user.id) return false;

  const userEmail = normalizeEmail(user.email);
  const invitedEmail = normalizeEmail(invite.invited_email);
  const legacyEmail = normalizeEmail(invite.invitee_email);

  if (invitedEmail && invitedEmail !== userEmail) return false;
  if (legacyEmail && legacyEmail !== userEmail) return false;

  return true;
}

export function isInviteExpired(invite: InviteLookup, now: Date = new Date()) {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at).getTime() < now.getTime();
}
