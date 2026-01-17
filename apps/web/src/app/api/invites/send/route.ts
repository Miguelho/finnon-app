import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateInviteCode, hashInviteToken } from "@poleursus/shared/src/utils/invite";
import { normalizeEmail, createServiceRoleClient, getAuthenticatedUser } from "@/lib/invites";

const sendInviteSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["viewer", "contributor", "admin"]),
  expiresInDays: z.number().int().positive().max(365).optional(),
  generateCode: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = sendInviteSchema.parse(body);
    const { accountId, email, role, expiresInDays, generateCode } = validated;

    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { errorKey: "errors.noSession" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceRoleClient();

    const { data: membership, error: memberError } = await serviceClient
      .from("account_members")
      .select("role")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();

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

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const { data: invitee } = await serviceClient
      .from("profiles")
      .select("user_id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (invitee?.user_id) {
      const { data: existingMember } = await serviceClient
        .from("account_members")
        .select("user_id")
        .eq("account_id", accountId)
        .eq("user_id", invitee.user_id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ status: "already_member" });
      }
    }

    const { data: pendingInvite } = await serviceClient
      .from("invites")
      .select("id, expires_at, status")
      .eq("account_id", accountId)
      .eq("invited_email", normalizedEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      const isExpired = new Date(pendingInvite.expires_at).getTime() < Date.now();
      if (!isExpired) {
        return NextResponse.json({ status: "pending" });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? 14));

    let inviteCode: string | null = null;
    let codeHash: string | null = null;

    if (generateCode) {
      let attempts = 0;
      while (attempts < 5) {
        const candidate = generateInviteCode();
        const candidateHash = hashInviteToken(candidate);
        const { data: existingCode } = await serviceClient
          .from("invites")
          .select("id")
          .eq("code_hash", candidateHash)
          .maybeSingle();

        if (!existingCode) {
          inviteCode = candidate;
          codeHash = candidateHash;
          break;
        }

        attempts += 1;
      }
    }

    if (generateCode && !inviteCode) {
      return NextResponse.json(
        { errorKey: "errors.inviteCreateFailed" },
        { status: 500 }
      );
    }

    const { data: invite, error: insertError } = await serviceClient
      .from("invites")
      .insert({
        account_id: accountId,
        invited_email: normalizedEmail,
        invitee_email: normalizedEmail,
        invitee_user_id: invitee?.user_id ?? null,
        role,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        code: inviteCode,
        code_hash: codeHash,
      })
      .select("id, expires_at, role")
      .single();

    if (insertError || !invite) {
      console.error("Error creating in-app invite:", insertError);
      return NextResponse.json(
        { errorKey: "errors.inviteCreateFailed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "created",
      inviteId: invite.id,
      expiresAt: invite.expires_at,
      role: invite.role,
      code: inviteCode,
    });
  } catch (error) {
    console.error("Send invite error:", error);

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
