import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
const supabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

/**
 * Indicates whether real Supabase Auth credentials are provided via environment variables.
 * In accordance with project security rules: do not create a fake/dummy client when unconfigured.
 */
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Singleton Supabase JS client instance when configured; null otherwise.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
