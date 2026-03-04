/**
 * POST /api/simulate/payment
 * Mock Razorpay payment — calls record_payment RPC + optionally earns loyalty points.
 * Session-authenticated — any logged-in admin can use the simulator.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/src/lib/config/environment";
import { randomBytes } from "crypto";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const userClient = createServerClient(
      supabaseEnv.url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.clinic_id) {
      return NextResponse.json({ error: "No clinic associated with your profile" }, { status: 403 });
    }

    const clinicId = callerProfile.clinic_id;

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = await req.json() as {
      invoice_id: string;
      amount: number;
      payment_mode?: string;
    };

    if (!body.invoice_id || !body.amount) {
      return NextResponse.json({ error: "invoice_id and amount are required" }, { status: 400 });
    }

    const admin = adminClient();

    // ── Step 1: Fetch invoice ─────────────────────────────────────────────────
    const { data: invoice, error: fetchErr } = await admin
      .from("pending_invoices")
      .select("patient_id, patient_name")
      .eq("id", body.invoice_id)
      .single();

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // ── Step 2: Generate mock Razorpay payment ID ─────────────────────────────
    const paymentId = `rzp_test_${randomBytes(8).toString("hex")}`;

    // ── Step 3: Call record_payment RPC ───────────────────────────────────────
    const { data: rpcResult, error: rpcErr } = await admin.rpc("record_payment", {
      p_invoice_id: body.invoice_id,
      p_clinic_id: clinicId,
      p_amount: body.amount,
      p_payment_mode: body.payment_mode ?? "card",
      p_transaction_ref: paymentId,
      p_notes: "Simulated — Aesthetica Simulator",
      p_recorded_by: null,
    });

    if (rpcErr) {
      console.error("[simulate/payment] record_payment error:", rpcErr.message);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    const newStatus = (rpcResult as { new_status?: string })?.new_status ?? "partial";

    // ── Step 4: Insert notification if fully paid ─────────────────────────────
    if (newStatus === "paid") {
      void admin.from("notifications").insert({
        clinic_id: clinicId,
        type: "payment",
        title: "Payment Received (Simulated)",
        body: `${invoice.patient_name} — ₹${body.amount} via Razorpay test: ${paymentId}`,
        is_read: false,
      });
    }

    // ── Step 5: Earn loyalty points (fire-and-forget) ─────────────────────────
    if (invoice.patient_id) {
      void admin.rpc("earn_loyalty_points", {
        p_patient_id: invoice.patient_id,
        p_clinic_id: clinicId,
        p_amount: body.amount,
      });
    }

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      new_status: newStatus,
      amount: body.amount,
    });
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
