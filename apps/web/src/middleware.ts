import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const detectedLocale = acceptLanguage.includes("es")
    ? "es"
    : acceptLanguage.includes("en")
      ? "en"
      : "es";

  const applyLocaleCookie = (response: NextResponse) => {
    if (!localeCookie) {
      response.cookies.set("NEXT_LOCALE", detectedLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return response;
  };

  // Skip middleware for API routes (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return applyLocaleCookie(NextResponse.next());
  }

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/login", "/login-otp", "/auth/callback", "/auth/confirm", "/join", "/privacy"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Crear cliente Supabase para el middleware usando cookies
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si es ruta pública, permitir acceso
  if (isPublicRoute) {
    // Si está en login y ya tiene usuario, redirigir a home
    if (pathname === "/login" && user) {
      return applyLocaleCookie(NextResponse.redirect(new URL("/", request.url)));
    }
    return applyLocaleCookie(response);
  }

  // Si no hay usuario y no es ruta pública, redirigir a login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return applyLocaleCookie(NextResponse.redirect(loginUrl));
  }

  // Si hay usuario, verificar si tiene cuentas (como owner O como miembro)
  const accountGateExemptRoutes = ["/select-account", "/onboarding", "/invitations"];
  const isAccountGateExempt = accountGateExemptRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isAccountGateExempt) {
    const activeAccountId = request.cookies.get("finnon:activeAccountId")?.value;
    const { data: memberships } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .limit(1);

    // Si no es miembro de ninguna cuenta, redirigir a onboarding
    if (!memberships || memberships.length === 0) {
      return applyLocaleCookie(
        NextResponse.redirect(new URL("/onboarding", request.url))
      );
    }

    // Si tiene cuentas pero no hay cuenta activa, ir a selección
    if (!activeAccountId) {
      return applyLocaleCookie(
        NextResponse.redirect(new URL("/select-account", request.url))
      );
    }
  }

  return applyLocaleCookie(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
