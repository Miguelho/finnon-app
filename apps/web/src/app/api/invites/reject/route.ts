import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createServiceRoleClient,
  getAuthenticatedUser,
  inviteMatchesUser,
  isInviteExpired,
  type InviteLookup,
} from "@/lib/invites";

const rejectInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = rejectInviteSchema.parse(body);

    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { errorKey: "errors.noSession" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient
      .from("invites")
      .select(
        "id, account_id, role, status, expires_at, revoked_at, invited_email, invitee_user_id, invitee_email"
      )
      .eq("id", validated.inviteId)
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

    const { error: updateError } = await serviceClient
      .from("invites")
      .update({ status: "rejected", responded_at: now.toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error rejecting invite:", updateError);
      return NextResponse.json(
        { errorKey: "errors.inviteJoinFailed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "rejected" });
  } catch (error) {
    console.error("Reject invite error:", error);

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
