import { type NextRequest, NextResponse } from "next/server";

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
    return true; // allowed
  }
  if (bucket.count >= limit) return false; // blocked
  bucket.count++;
  return true; // allowed
}

// Periodically clean up expired buckets to prevent memory leaks
// (runs lazily on each request — cheap amortised O(1))
let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of rateBuckets) {
    if (v.resetAt <= now) rateBuckets.delete(k);
  }
}

export function middleware(req: NextRequest) {
  maybeCleanup();

  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  // ── OTP request: 3 per phone per 10 minutes ──────────────────────────────
  if (pathname === "/api/portal/request-otp" && req.method === "POST") {
    // We rate-limit by IP here (phone only available in body; parsing body in
    // middleware is possible but costly — IP is sufficient for abuse prevention)
    const key = `otp:${ip}`;
    if (!rateLimit(key, 3, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again in 10 minutes." },
        { status: 429 }
      );
    }
  }

  // ── Leads API: 100 per IP per hour ───────────────────────────────────────
  if (pathname === "/api/leads" && req.method === "POST") {
    const key = `leads:${ip}`;
    if (!rateLimit(key, 100, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  // ── Inbound webhook routes: 500 per IP per hour ───────────────────────────
  if (pathname.startsWith("/api/webhooks/inbound/")) {
    const key = `wh:${ip}`;
    if (!rateLimit(key, 500, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  // ── Public intake form submit: 20 per IP per 10 minutes ──────────────────
  if (pathname === "/api/intake/submit" && req.method === "POST") {
    const key = `intake:${ip}`;
    if (!rateLimit(key, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/portal/request-otp",
    "/api/leads",
    "/api/webhooks/inbound/:path*",
    "/api/intake/submit",
  ],
};
