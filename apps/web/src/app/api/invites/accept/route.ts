import { NextRequest, NextResponse } from "next/server";
import { acceptInviteSchema } from "@poleursus/shared";
import { hashInviteToken } from "@poleursus/shared/src/utils/invite";
import {
  createServiceRoleClient,
  getAuthenticatedUser,
  inviteMatchesUser,
  isInviteExpired,
  type InviteLookup,
} from "@/lib/invites";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedData = acceptInviteSchema.parse(body);
    const { token, inviteId, code } = validatedData;

    // 2. Get current user session (cookies or Authorization header)
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          errorKey: "errors.noSession",
        },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();
    let invite: InviteLookup | null = null;

    if (token) {
      const tokenHash = hashInviteToken(token);
      const { data, error } = await serviceClient
        .from("invites")
        .select(
          "id, account_id, role, status, expires_at, revoked_at, max_uses, uses_count, invited_email, invitee_user_id, invitee_email"
        )
        .eq("token_hash", tokenHash)
        .single();

      if (error || !data) {
        console.error("Invite lookup error:", error);
        return NextResponse.json(
          { errorKey: "errors.inviteInvalidToken" },
          { status: 404 }
        );
      }

      invite = data as InviteLookup;
    } else if (inviteId) {
      const { data, error } = await serviceClient
        .from("invites")
        .select(
          "id, account_id, role, status, expires_at, revoked_at, invited_email, invitee_user_id, invitee_email"
        )
        .eq("id", inviteId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { errorKey: "errors.inviteInvalidOrExpired" },
          { status: 404 }
        );
      }

      invite = data as InviteLookup;
    } else if (code) {
      const normalizedCode = code.trim().toUpperCase();
      const codeHash = hashInviteToken(normalizedCode);
      const { data, error } = await serviceClient
        .from("invites")
        .select(
          "id, account_id, role, status, expires_at, revoked_at, invited_email, invitee_user_id, invitee_email"
        )
        .eq("code_hash", codeHash)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { errorKey: "errors.inviteInvalidOrExpired" },
          { status: 404 }
        );
      }

      invite = data as InviteLookup;
    }

    if (!invite) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    if (!inviteMatchesUser(invite, user)) {
      return NextResponse.json(
        { errorKey: "errors.inviteInvalidRecipient" },
        { status: 403 }
      );
    }

    const now = new Date();
    const status = invite.status ?? "pending";

    if (invite.revoked_at || status === "revoked") {
      return NextResponse.json(
        { errorKey: "errors.inviteRevoked" },
        { status: 410 }
      );
    }

    if (status === "accepted" || status === "rejected") {
      return NextResponse.json(
        { errorKey: "errors.inviteInvalidOrExpired" },
        { status: 409 }
      );
    }

    if (status === "expired" || isInviteExpired(invite, now)) {
      await serviceClient
        .from("invites")
        .update({ status: "expired", responded_at: now.toISOString() })
        .eq("id", invite.id);

      return NextResponse.json(
        { errorKey: "errors.inviteExpired" },
        { status: 410 }
      );
    }

    if (
      token &&
      invite.max_uses !== null &&
      typeof invite.uses_count === "number" &&
      invite.uses_count >= invite.max_uses
    ) {
      return NextResponse.json(
        { errorKey: "errors.inviteMaxUses" },
        { status: 429 }
      );
    }

    // Upsert membership (idempotent)
    const { error: memberError } = await serviceClient
      .from("account_members")
      .upsert(
        {
          account_id: invite.account_id,
          user_id: user.id,
          role: invite.role,
        },
        {
          onConflict: "account_id,user_id",
          ignoreDuplicates: true,
        }
      );

    if (memberError) {
      console.error("Error adding member:", memberError);
      return NextResponse.json(
        { errorKey: "errors.inviteJoinFailed" },
        { status: 500 }
      );
    }

    const isTargeted = Boolean(
      invite.invited_email || invite.invitee_email || invite.invitee_user_id
    );

    if (token && !isTargeted && typeof invite.uses_count === "number") {
      const { error: updateError } = await serviceClient
        .from("invites")
        .update({ uses_count: invite.uses_count + 1 })
        .eq("id", invite.id);

      if (updateError) {
        console.error("Error updating invite uses:", updateError);
      }
    } else {
      const { error: updateError } = await serviceClient
        .from("invites")
        .update({ status: "accepted", responded_at: now.toISOString() })
        .eq("id", invite.id);

      if (updateError) {
        console.error("Error updating invite status:", updateError);
      }
    }

    return NextResponse.json({
      accountId: invite.account_id,
      role: invite.role,
    });
  } catch (error) {
    console.error("Accept invite error:", error);

    // Handle Zod validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { errorKey: "errors.internalServer" },
      { status: 500 }
    );
  }
}
