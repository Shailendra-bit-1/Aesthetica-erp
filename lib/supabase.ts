import { createBrowserClient } from "@supabase/ssr";

/**
 * HIPAA-compliant Supabase client.
 *
 * createBrowserClient from @supabase/ssr stores the auth session in
 * COOKIES (not localStorage), satisfying the HIPAA requirement that
 * no PHI or auth tokens are written to browser storage.
 *
 * Do NOT replace this with the default @supabase/supabase-js client —
 * that client uses localStorage by default.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
