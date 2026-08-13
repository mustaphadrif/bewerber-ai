import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client.
 * Returns null when env vars are missing so the app can run in "no-env" mode
 * (auth pages show a graceful notice, data features show demo/empty states).
 */
export function createClient(): ReturnType<typeof createBrowserClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
