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

  // Log para debug
  console.log("Auth callback:", {
    code: code?.substring(0, 10) + "...",
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

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Exchange code error:", error);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    if (data.session) {
      console.log("Session created successfully");
      console.log("Response cookies:", [...redirectResponse.cookies.getAll()].map(c => c.name));
      // Return redirect with cookies already set
      return redirectResponse;
    }
  }

  // Si no hay code ni error, algo está mal
  console.error("No code or error in callback");
  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
