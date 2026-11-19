import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using SUPABASE_SECRET_KEY.
 * NEVER import this module in Client Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY environment variable.");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
