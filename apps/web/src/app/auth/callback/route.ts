import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
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
      // Redirigir a la home (el middleware se encargará de redirigir a onboarding si es necesario)
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // Si no hay code ni error, algo está mal
  console.error("No code or error in callback");
  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
