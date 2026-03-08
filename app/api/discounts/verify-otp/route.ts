import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { approval_id, otp } = await req.json();
    if (!approval_id || !otp) {
      return NextResponse.json({ error: "approval_id and otp required" }, { status: 400 });
    }

    const { data: approval } = await supabaseAdmin
      .from("discount_approvals")
      .select("id, otp_code, otp_expires_at, status")
      .eq("id", approval_id)
      .maybeSingle();

    if (!approval) {
      return NextResponse.json({ error: "Invalid approval request" }, { status: 400 });
    }
    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Approval already used or expired" }, { status: 400 });
    }
    if (new Date(approval.otp_expires_at) < new Date()) {
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }
    if (approval.otp_code !== String(otp).trim()) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    await supabaseAdmin
      .from("discount_approvals")
      .update({ status: "approved", approved_by: user.id })
      .eq("id", approval_id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("discount verify error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
