import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashInviteToken } from "@poleursus/shared/src/utils/invite";
import {
  createServiceRoleClient,
  getAuthenticatedUser,
  inviteMatchesUser,
  isInviteExpired,
  type InviteLookup,
} from "@/lib/invites";

const joinByCodeSchema = z.object({
  code: z.string().min(4),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = joinByCodeSchema.parse(body);

    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { errorKey: "errors.noSession" },
        { status: 401 }
      );
    }

    const normalizedCode = validated.code.trim().toUpperCase();
    const codeHash = hashInviteToken(normalizedCode);
    const serviceClient = createServiceRoleClient();
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

    const invite = data as InviteLookup;

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

    const { error: updateError } = await serviceClient
      .from("invites")
      .update({ status: "accepted", responded_at: now.toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error updating invite status:", updateError);
    }

    return NextResponse.json({
      accountId: invite.account_id,
      role: invite.role,
    });
  } catch (error) {
    console.error("Join by code error:", error);

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
