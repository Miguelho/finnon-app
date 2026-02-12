import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase/env";

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Create browser client that uses cookies (compatible with server-side)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
