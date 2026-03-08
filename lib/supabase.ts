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
 *
 * Lazy-initialized via Proxy so importing this module at build time
 * (e.g. in server API routes via lib/audit.ts) does not throw when
 * env vars are unavailable during Next.js "Collecting page data" phase.
 */
type BrowserClient = ReturnType<typeof createBrowserClient>;

let _client: BrowserClient | null = null;

function getClient(): BrowserClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export const supabase = new Proxy({} as BrowserClient, {
  get(_, prop: string | symbol) {
    const client = getClient();
    const val = (client as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});
