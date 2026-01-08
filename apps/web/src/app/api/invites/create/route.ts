import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { createInviteSchema } from "@poleursus/shared";
import {
  generateInviteToken,
  hashInviteToken,
  buildInviteUrl,
} from "@poleursus/shared/src/utils/invite";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedData = createInviteSchema.parse(body);
    const { accountId, role, expiresInHours, maxUses } = validatedData;

    // 2. Get authenticated user (support both cookies and Authorization header)
    const authHeader = request.headers.get("authorization");
    let supabase;
    let user;

    if (authHeader?.startsWith("Bearer ")) {
      // Mobile/API client with Authorization header
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
        console.log("Auth error with token:", error);
        return NextResponse.json(
          { errorKey: "errors.unauthorized" },
          { status: 401 }
        );
      }
      user = authUser;
    } else {
      // Web client with cookies
      const authenticated = await createAuthenticatedClient();
      supabase = authenticated.client;
      user = authenticated.user;
    }

    // 3. Verify user is admin of the account (RLS will enforce, but explicit check for better errors)
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

    // 4. Generate token (NEVER log this plaintext token except in response)
    const plainToken = generateInviteToken();
    const tokenHash = hashInviteToken(plainToken);

    // 5. Calculate expiration
    let expiresAt: Date;
    if (expiresInHours !== undefined) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    } else {
      // "Unlimited" = fecha muy lejana (100 años)
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100);
    }

    // 6. Insert invite into database
    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert({
        account_id: accountId,
        token_hash: tokenHash,
        role,
        expires_at: expiresAt.toISOString(),
        max_uses: maxUses ?? null,
        uses_count: 0,
        created_by: user.id,
      })
      .select("id, expires_at, role")
      .single();

    if (insertError) {
      console.error("Error creating invite:", insertError);
      return NextResponse.json(
        { errorKey: "errors.inviteCreateFailed" },
        { status: 500 }
      );
    }

    // 7. Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const inviteUrl = buildInviteUrl(baseUrl, plainToken);

    // 8. Return response
    return NextResponse.json({
      inviteUrl,
      expiresAt: invite.expires_at,
      role: invite.role,
    });
  } catch (error) {
    console.error("Create invite error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message === "No hay sesión activa válida") {
      return NextResponse.json(
        { errorKey: "errors.authRequired" },
        { status: 401 }
      );
    }

    // Handle Zod validation errors
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
