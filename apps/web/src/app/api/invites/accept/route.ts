import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { acceptInviteSchema } from "@poleursus/shared";
import { hashInviteToken } from "@poleursus/shared/src/utils/invite";

// Create service role client for bypassing RLS (used only for invite acceptance)
function createServiceRoleClient() {
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

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedData = acceptInviteSchema.parse(body);
    const { token } = validatedData;

    // 2. Get current user session (may be anonymous or authenticated)
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          errorKey: "errors.noSession",
        },
        { status: 401 }
      );
    }

    // 3. Hash the token for database lookup
    const tokenHash = hashInviteToken(token);

    // 4. Lookup invite by token hash
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select(
        "id, account_id, role, expires_at, revoked_at, max_uses, uses_count"
      )
      .eq("token_hash", tokenHash)
      .single();

    if (inviteError || !invite) {
      console.error("Invite lookup error:", inviteError);
      console.error("Invite not found for token hash:", tokenHash);
      return NextResponse.json(
        { errorKey: "errors.inviteInvalidToken" },
        { status: 404 }
      );
    }

    // 5. Validate invite status
    const now = new Date();

    if (invite.revoked_at) {
      return NextResponse.json(
        { errorKey: "errors.inviteRevoked" },
        { status: 410 }
      );
    }

    if (new Date(invite.expires_at) < now) {
      return NextResponse.json(
        { errorKey: "errors.inviteExpired" },
        { status: 410 }
      );
    }

    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
      return NextResponse.json(
        { errorKey: "errors.inviteMaxUses" },
        { status: 429 }
      );
    }

    // 6. Use service role client for write operations (bypasses RLS)
    // This is secure because we've already validated:
    // - User has a valid session (anonymous or authenticated)
    // - Invite token is valid, not expired, not revoked, within usage limits
    const serviceClient = createServiceRoleClient();

    // 7. Upsert user into account_members
    // The UNIQUE constraint on (account_id, user_id) ensures idempotency
    // If user is already a member, preserve their existing role (don't downgrade admins)
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
          ignoreDuplicates: true, // Preserve existing role if already a member
        }
      );

    if (memberError) {
      console.error("Error adding member:", memberError);
      return NextResponse.json(
        { errorKey: "errors.inviteJoinFailed" },
        { status: 500 }
      );
    }

    // 8. Increment uses_count
    const { error: updateError } = await serviceClient
      .from("invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error updating invite uses:", updateError);
      // Non-fatal: member was added successfully, just log the error
    }

    // 9. Return success
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
