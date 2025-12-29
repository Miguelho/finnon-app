import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Las cookies solo se pueden modificar en Server Actions o Route Handlers
          }
        },
      },
    }
  );
}

/**
 * Crea un cliente de Supabase con sesión explícita para operaciones RLS críticas.
 *
 * Esta función fuerza el refresh de sesión para garantizar que el JWT token
 * se propague correctamente a PostgreSQL en Server Actions de Next.js 15.
 *
 * Usar este cliente cuando:
 * - Se ejecuten operaciones INSERT/UPDATE/DELETE con políticas RLS
 * - Se requiera garantizar que auth.uid() tenga el valor correcto en PostgreSQL
 *
 * @throws {Error} Si no hay sesión activa válida
 * @returns Cliente de Supabase con JWT garantizado y usuario autenticado
 */
export async function createAuthenticatedClient() {
  const cookieStore = await cookies();

  // Primero crear un cliente temporal solo para obtener el token
  const tempClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Las cookies solo se pueden modificar en Server Actions o Route Handlers
          }
        },
      },
    }
  );

  // Obtener la sesión con el token
  const { data: { session }, error } = await tempClient.auth.getSession();

  if (error || !session) {
    throw new Error("No hay sesión activa válida");
  }

  // console.log("🔍 DEBUG - Session info:", {
  //   hasAccessToken: !!session.access_token,
  //   tokenLength: session.access_token?.length,
  //   userId: session.user?.id,
  //   expiresAt: session.expires_at,
  // });

  // CRÍTICO: Usar el access_token del usuario como la API key
  // Esto asegura que TODAS las peticiones usen el JWT del usuario autenticado
  const authenticatedClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    session.access_token, // <-- USAR ACCESS TOKEN COMO API KEY
    {
      auth: {
        persistSession: false, // No persistir en Server Actions
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    }
  );

  //console.log("✅ Client created with access_token as API key (using @supabase/supabase-js)");

  return { client: authenticatedClient, user: session.user };
}
