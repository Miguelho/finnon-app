import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const emailOtpTypes: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

const isEmailOtpType = (value: string | null): value is EmailOtpType =>
  value !== null && emailOtpTypes.includes(value as EmailOtpType);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const email = requestUrl.searchParams.get("email");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const error_description = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;

  // Log para debug
  console.log("Auth callback:", {
    code: code ? `${code.substring(0, 10)}...` : null,
    tokenHash: tokenHash ? `${tokenHash.substring(0, 10)}...` : null,
    type,
    error_description,
    url: requestUrl.toString()
  });

  // Si hay un error en los parámetros, redirigir a login
  if (error_description) {
    console.error("Error in callback:", error_description);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    );
  }

  if (code || tokenHash) {
    const cookieStore = await cookies();
    // Create redirect response first so we can set cookies on it
    const redirectResponse = NextResponse.redirect(`${origin}/`);

    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // Set cookies on the redirect response so they're included
            console.log("Setting cookies:", cookiesToSet.map(c => c.name));
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    if (code) {
      const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);

      if (codeError) {
        console.error("Auth callback PKCE error:", codeError);
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "pkce_failed");
        if (email) {
          loginUrl.searchParams.set("email", email);
        }
        return NextResponse.redirect(loginUrl);
      }
    } else if (tokenHash && isEmailOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (error) {
        console.error("Auth callback error:", error);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(error.message)}`
        );
      }
    } else {
      const authError = new Error("Invalid or missing OTP type");
      console.error("Auth callback error:", authError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(authError.message)}`
      );
    }

    console.log("Session created successfully");
    console.log("Response cookies:", [...redirectResponse.cookies.getAll()].map(c => c.name));
    // Return redirect with cookies already set
    return redirectResponse;
  }

  // Si no hay code ni error, algo está mal
  console.error("No code or error in callback");
  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
