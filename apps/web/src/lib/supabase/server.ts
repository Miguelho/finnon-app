import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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
 * Crea un cliente de Supabase autenticado con el JWT del usuario para operaciones RLS.
 *
 * Importante: la API key de Supabase siempre debe ser `anon` o `service_role`.
 * El access token del usuario se envía en `Authorization: Bearer ...`.
 *
 * @throws {Error} Si no hay sesión activa válida
 * @returns Cliente de Supabase autenticado y usuario de la sesión
 */
export async function createAuthenticatedClient() {
  const cookieStore = await cookies();

  // Primero crear un cliente temporal solo para obtener el token
  const tempClient = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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

  // Obtener la sesión para extraer el access token
  const {
    data: { session },
    error: sessionError,
  } = await tempClient.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("No hay sesión activa válida");
  }

  // Validar identidad contra Auth server (no confiar en session.user local)
  const {
    data: { user },
    error: userError,
  } = await tempClient.auth.getUser();

  if (userError || !user) {
    throw new Error("No hay usuario autenticado válido");
  }

  // console.log("🔍 DEBUG - Session info:", {
  //   hasAccessToken: !!session.access_token,
  //   tokenLength: session.access_token?.length,
  //   expiresAt: session.expires_at,
  // });

  // Usar anon key como API key y JWT del usuario en Authorization.
  const authenticatedClient = createSupabaseClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "public",
      },
    }
  );

  //console.log("✅ Client created with anon key + Authorization bearer token");

  return { client: authenticatedClient, user };
}
