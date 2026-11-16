"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Trimmed in case a dashboard value was pasted with a trailing newline.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

let client: SupabaseClient | null | undefined;

/**
 * The browser's Supabase client, or null when the project isn't configured
 * (no env vars). The game works fully without it; accounts and the
 * leaderboard just don't appear.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (typeof window === "undefined" || !url || !key) return (client = null);
  client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // The /auth/callback page exchanges the code itself.
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(url && key);
}
