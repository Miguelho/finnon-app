import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error_description = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;

  console.log("Auth callback:", {
    code: code ? `${code.substring(0, 10)}...` : null,
    error_description,
    url: requestUrl.toString()
  });

  if (error_description) {
    console.error("Error in callback:", error_description);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();
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
            console.log("Setting cookies:", cookiesToSet.map(c => c.name));
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);

    if (codeError) {
      console.error("Auth callback PKCE error:", codeError);
      return NextResponse.redirect(`${origin}/login?error=pkce_failed`);
    }

    console.log("Session created successfully");
    console.log("Response cookies:", [...redirectResponse.cookies.getAll()].map(c => c.name));
    return redirectResponse;
  }

  console.error("No code in callback");
  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
