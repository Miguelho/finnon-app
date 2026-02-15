import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminKey, getSupabaseUrl } from "./supabase/env";

const supabaseUrl = getSupabaseUrl();
const supabaseServiceRoleKey = getSupabaseAdminKey();

/**
 * Supabase client for server-side operations with service role.
 * WARNING: This client bypasses RLS. Only use in trusted server contexts.
 * NEVER expose this client or its key to the browser.
 */
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
