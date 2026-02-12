import type { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

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
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
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
      getSupabaseUrl(),
      getSupabaseAnonKey(),
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
  const userEmail = normalizeEmail(user.email);
  const invitedEmail = normalizeEmail(invite.invited_email);
  const legacyEmail = normalizeEmail(invite.invitee_email);

  // Si la invitación tiene invitee_user_id, debe coincidir
  if (invite.invitee_user_id) {
    return invite.invitee_user_id === user.id;
  }

  // Si la invitación tiene email (nuevo o legacy), debe coincidir
  if (invitedEmail) {
    return invitedEmail === userEmail;
  }
  if (legacyEmail) {
    return legacyEmail === userEmail;
  }

  // Invitación genérica sin email: rechazar (validación estricta)
  return false;
}

export function isInviteExpired(invite: InviteLookup, now: Date = new Date()) {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at).getTime() < now.getTime();
}
