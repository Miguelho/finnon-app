const requireEnv = (keys: readonly string[], label: string): string => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  throw new Error(
    `Missing Supabase ${label}. Define one of: ${keys.join(", ")}`
  );
};

export const getSupabaseUrl = () =>
  requireEnv(
    ["NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"],
    "project URL"
  );

export const getSupabaseAnonKey = () =>
  requireEnv(
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY"],
    "anon key"
  );

export const getSupabaseServiceRoleKey = () =>
  requireEnv(["SUPABASE_SERVICE_ROLE_KEY"], "service role key");
