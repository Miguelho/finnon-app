import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/login", "/login-otp", "/auth/callback", "/join"];
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Obtener usuario (más seguro que getSession)
  console.log("Middleware - cookies:", request.cookies.getAll().map(c => c.name));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("Middleware - user:", user?.id ?? "NO USER");

  // Si es ruta pública, permitir acceso
  if (isPublicRoute) {
    // Si está en login y ya tiene usuario, redirigir a home
    if (pathname === "/login" && user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // Si no hay usuario y no es ruta pública, redirigir a login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay usuario, verificar si tiene cuentas (como owner O como miembro)
  if (pathname !== "/select-account" && pathname !== "/onboarding") {
    const { data: memberships } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .limit(1);

    // Si no es miembro de ninguna cuenta, redirigir a selección de cuenta
    if (!memberships || memberships.length === 0) {
      return NextResponse.redirect(new URL("/select-account", request.url));
    }
  }

  return response;
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
