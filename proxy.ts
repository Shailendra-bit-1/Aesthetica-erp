import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── GAP-11: Simple in-process rate limiting for public routes ────────────────
// Uses an in-memory map (per worker pod). For multi-pod deployments, replace
// with Upstash Redis Rate Limit or similar distributed solution.

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of rateBuckets) {
    if (v.resetAt <= now) rateBuckets.delete(k);
  }
}

export async function proxy(request: NextRequest) {
  maybeCleanup();

  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // ── Rate limiting for public API routes ──────────────────────────────────
  if (pathname === "/api/portal/request-otp" && request.method === "POST") {
    if (!rateLimit(`otp:${ip}`, 3, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again in 10 minutes." },
        { status: 429 }
      );
    }
  }

  if (pathname === "/api/leads" && request.method === "POST") {
    if (!rateLimit(`leads:${ip}`, 100, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  if (pathname.startsWith("/api/webhooks/inbound/")) {
    if (!rateLimit(`wh:${ip}`, 500, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  if (pathname === "/api/intake/submit" && request.method === "POST") {
    if (!rateLimit(`intake:${ip}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
    }
  }

  // Build a mutable response so Supabase can refresh tokens via Set-Cookie
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() (not getSession()) — validates the JWT server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── /login is public ─────────────────────────────────────────────────────
  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // ── /intake/* and /portal/* are public (patient-facing, no auth required) ─
  if (
    pathname.startsWith("/intake") ||
    pathname.startsWith("/api/intake") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/portal")
  ) {
    return response;
  }

  // ── Every other route requires a valid session ────────────────────────────
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
