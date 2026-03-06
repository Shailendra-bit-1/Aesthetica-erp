import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { payslip_id, clinic_id } = await req.json();
    if (!payslip_id || !clinic_id) {
      return NextResponse.json({ error: "payslip_id and clinic_id required" }, { status: 400 });
    }

    // Fetch payslip + staff profile
    const { data: payslip, error: psErr } = await supabaseAdmin
      .from("payslips")
      .select("*, profiles!staff_id(id, full_name, role)")
      .eq("id", payslip_id)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (psErr || !payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const staffProfile = Array.isArray(payslip.profiles) ? payslip.profiles[0] : payslip.profiles;
    if (!staffProfile?.id) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    // Get staff email from auth.users via admin API
    const { data: { user: staffUser }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(staffProfile.id);
    if (userErr || !staffUser?.email) {
      return NextResponse.json({ error: "Staff email not found — ensure the staff member has a valid account" }, { status: 422 });
    }

    // Fetch clinic name
    const { data: clinicRow } = await supabaseAdmin
      .from("clinics")
      .select("name")
      .eq("id", clinic_id)
      .maybeSingle();
    const clinicName = clinicRow?.name ?? "Aesthetica";

    // Build payslip HTML
    const net = (payslip.net_pay ?? 0).toLocaleString("en-IN");
    const gross = ((payslip.basic_salary ?? 0) + (payslip.commission_total ?? 0) + (payslip.allowances ?? 0)).toLocaleString("en-IN");
    const html = `
<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#C5A059,#A8853A);padding:24px;color:#fff">
    <h2 style="margin:0 0 4px;font-size:20px">${clinicName}</h2>
    <p style="margin:0;font-size:13px;opacity:0.85">Payslip</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1a1714">Dear ${staffProfile.full_name},</p>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280">Please find your payslip details below.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#fafaf9"><td style="padding:8px 12px;color:#6b7280">Basic Salary</td><td style="padding:8px 12px;text-align:right;font-weight:600">₹${(payslip.basic_salary ?? 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:8px 12px;color:#6b7280">Commission</td><td style="padding:8px 12px;text-align:right;font-weight:600">₹${(payslip.commission_total ?? 0).toLocaleString("en-IN")}</td></tr>
      <tr style="background:#fafaf9"><td style="padding:8px 12px;color:#6b7280">Allowances</td><td style="padding:8px 12px;text-align:right;font-weight:600">₹${(payslip.allowances ?? 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:8px 12px;color:#6b7280;font-weight:600">Gross Pay</td><td style="padding:8px 12px;text-align:right;font-weight:700">₹${gross}</td></tr>
      <tr style="background:#fafaf9"><td style="padding:8px 12px;color:#dc2626">Deductions</td><td style="padding:8px 12px;text-align:right;color:#dc2626">−₹${(payslip.deductions ?? 0).toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:8px 12px;color:#dc2626">TDS</td><td style="padding:8px 12px;text-align:right;color:#dc2626">−₹${(payslip.tds ?? 0).toLocaleString("en-IN")}</td></tr>
      <tr style="border-top:2px solid #C5A059"><td style="padding:10px 12px;font-weight:700;font-size:14px">Net Pay</td><td style="padding:10px 12px;text-align:right;font-weight:700;font-size:16px;color:#C5A059">₹${net}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center">This is a system-generated payslip from ${clinicName}.</p>
  </div>
</div>`;

    // Call send-email API
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const emailRes = await fetch(`${origin}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic_id,
        to: staffUser.email,
        subject: `Your Payslip — ${clinicName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      return NextResponse.json({ error: err.error ?? "Failed to send email" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sent_to: staffUser.email });
  } catch (e) {
    console.error("email-payslip error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
