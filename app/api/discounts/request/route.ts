import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clinic_id, discount_pct } = await req.json();
    if (!clinic_id || !discount_pct) {
      return NextResponse.json({ error: "clinic_id and discount_pct required" }, { status: 400 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabaseAdmin.from("discount_approvals").insert({
      clinic_id,
      requested_by:  user.id,
      discount_pct:  Number(discount_pct),
      otp_code:      otp,
      otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status:        "pending",
    }).select("id").single();

    if (error) throw error;

    // In production, OTP would be sent to the clinic admin via SMS/WhatsApp.
    // For demo: return OTP in response (remove in production).
    return NextResponse.json({ approval_id: data.id, otp_demo: otp });
  } catch (e) {
    console.error("discount request error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
