import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

const COOKIE_NAME = "finnon:activeAccountId";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accountId = typeof body?.accountId === "string" ? body.accountId : null;

    if (!accountId) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const { client: supabase, user } = await createAuthenticatedClient();

    const { data: membership, error } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .single();

    if (error || !membership) {
      return NextResponse.json(
        { errorKey: "errors.accountNotFoundOrDenied" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ accountId });
    response.cookies.set(COOKIE_NAME, accountId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });

    return response;
  } catch (error) {
    console.error("Active account endpoint error:", error);

    if (error instanceof Error && error.message === "No hay sesión activa válida") {
      return NextResponse.json(
        { errorKey: "errors.authRequired" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { errorKey: "errors.internalServer" },
      { status: 500 }
    );
  }
}
