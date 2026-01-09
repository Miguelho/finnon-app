import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy endpoint for magic link verification.
 * Required for LAN access where the mobile device can't reach 127.0.0.1:54321 directly.
 * Uses POST /auth/v1/verify to get tokens directly (no PKCE needed).
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  // Get the real host from headers (for LAN access)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const realHost = forwardedHost || host || requestUrl.host;
  const realOrigin = `${requestUrl.protocol}//${realHost}`;

  console.log("[verify] Real host:", realHost);
  console.log("[verify] Full URL:", request.url);
  console.log("[verify] Method:", request.method);

  const token = requestUrl.searchParams.get("token");
  console.log("[verify] Token:", token?.substring(0, 10) + "...");
  const type = requestUrl.searchParams.get("type") || "magiclink";
  const email = requestUrl.searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(
      `${realOrigin}/login?error=${encodeURIComponent("Missing token or email")}`
    );
  }

  // Internal Supabase URL (accessible from server only)
  const supabaseInternalUrl = "http://127.0.0.1:54321";

  try {
    // Use POST /auth/v1/verify which returns tokens directly (no PKCE code exchange needed)
    const verifyResponse = await fetch(`${supabaseInternalUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        type,
        token,
        email,
      }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.error("[verify] Verification failed:", errorData);
      return NextResponse.redirect(
        `${realOrigin}/login?error=${encodeURIComponent(errorData.error_description || errorData.msg || "Verification failed")}`
      );
    }

    const session = await verifyResponse.json();
    console.log("[verify] Got session for user:", session.user?.email);

    // Create response with redirect to home
    const response = NextResponse.redirect(`${realOrigin}/`);

    // Set auth cookies using Supabase SSR format
    // The cookie name is derived from the Supabase URL hostname
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const projectRef = supabaseUrl.hostname.split(".")[0]; // e.g., "192" from "192.168.1.100"
    const cookieName = `sb-${projectRef}-auth-token`;

    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: requestUrl.protocol === "https:",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 1 week
    };

    // Supabase SSR expects the session data in a specific format
    response.cookies.set(cookieName, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }), cookieOptions);

    console.log("[verify] Session cookie set, redirecting to home");
    return response;

  } catch (error) {
    console.error("[verify] Error:", error);
    return NextResponse.redirect(
      `${realOrigin}/login?error=${encodeURIComponent("Verification error")}`
    );
  }
}
