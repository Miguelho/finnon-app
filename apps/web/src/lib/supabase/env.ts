const requireValue = (value: string | undefined, message: string): string => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(message);
};

export const getSupabaseUrl = () => {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  return requireValue(
    value,
    "Missing Supabase project URL. Define NEXT_PUBLIC_SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL at build time)."
  );
};

export const getSupabaseAnonKey = () => {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return requireValue(
    value,
    "Missing Supabase anon key. Define NEXT_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY at build time)."
  );
};

export const getSupabaseServiceRoleKey = () =>
  requireValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Missing Supabase service role key. Define SUPABASE_SERVICE_ROLE_KEY."
  );

export const getSupabaseAdminKey = () =>
  requireValue(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Missing Supabase admin key. Define SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY."
  );
