import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { inviteParticipantSchema } from "@poleursus/shared";
import {
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
} from "@poleursus/shared/src/utils/invite";

type InviteLookup = {
  revoked_at: string | null;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  invitee_user_id?: string | null;
  invitee_email?: string | null;
};

function isInviteActive(invite: InviteLookup | null, now: Date = new Date()) {
  if (!invite) return false;
  if (invite.revoked_at) return false;
  const isTargeted = Boolean(invite.invitee_user_id || invite.invitee_email);
  if (!isTargeted && new Date(invite.expires_at) < now) return false;
  if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = inviteParticipantSchema.parse(body);
    const { accountId, email, role, expiresInHours, maxUses } = validatedData;
    const normalizedEmail = email.trim().toLowerCase();

    const authHeader = request.headers.get("authorization");
    let supabase;
    let user;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { createClient } = await import("@supabase/supabase-js");
      supabase = createClient(
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
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      if (error || !authUser) {
        return NextResponse.json(
          { errorKey: "errors.unauthorized" },
          { status: 401 }
        );
      }
      user = authUser;
    } else {
      const authenticated = await createAuthenticatedClient();
      supabase = authenticated.client;
      user = authenticated.user;
    }

    const { data: membership, error: memberError } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { errorKey: "errors.accountNotFoundOrDenied" },
        { status: 404 }
      );
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { errorKey: "errors.inviteOnlyAdmins" },
        { status: 403 }
      );
    }

    const { data: invitee, error: inviteeError } = await supabase
      .from("profiles")
      .select("user_id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (inviteeError) {
      console.error("Error looking up invitee:", inviteeError);
      return NextResponse.json(
        { errorKey: "errors.profilesLoadFailed" },
        { status: 500 }
      );
    }

    if (!invitee) {
      return NextResponse.json(
        { errorKey: "errors.inviteUserNotFound" },
        { status: 404 }
      );
    }

    const { data: existingMember, error: existingError } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", accountId)
      .eq("user_id", invitee.user_id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { errorKey: "errors.membersLoadFailed" },
        { status: 500 }
      );
    }

    if (existingMember) {
      return NextResponse.json({ status: "already_member" });
    }

    const { data: pendingInvite, error: pendingError } = await supabase
      .from("invites")
      .select("revoked_at, expires_at, max_uses, uses_count, invitee_user_id, invitee_email")
      .eq("account_id", accountId)
      .eq("invitee_user_id", invitee.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json(
        { errorKey: "errors.inviteCreateFailed" },
        { status: 500 }
      );
    }

    if (isInviteActive(pendingInvite)) {
      return NextResponse.json({ status: "pending" });
    }

    const plainToken = generateInviteToken();
    const tokenHash = hashInviteToken(plainToken);
    let expiresAt: Date;
    if (expiresInHours !== undefined) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    } else {
      // "Unlimited" = fecha muy lejana (100 años)
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
    }

    const maxUsesValue = maxUses ?? 1;

    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert({
        account_id: accountId,
        token_hash: tokenHash,
        role,
        expires_at: expiresAt.toISOString(),
        max_uses: maxUsesValue,
        uses_count: 0,
        created_by: user.id,
        invitee_user_id: invitee.user_id,
        invitee_email: invitee.email ?? normalizedEmail,
      })
      .select("id, expires_at, role")
      .single();

    if (insertError) {
      console.error("Error creating registered invite:", insertError);
      return NextResponse.json(
        { errorKey: "errors.inviteCreateFailed" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const inviteUrl = buildInviteUrl(baseUrl, plainToken);

    return NextResponse.json({
      status: "created",
      inviteUrl,
      expiresAt: invite.expires_at,
      role: invite.role,
    });
  } catch (error) {
    console.error("Create registered invite error:", error);

    if (error instanceof Error && error.message === "No hay sesión activa válida") {
      return NextResponse.json(
        { errorKey: "errors.authRequired" },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { errorKey: "errors.internalServer" },
      { status: 500 }
    );
  }
}
