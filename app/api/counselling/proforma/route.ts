import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// POST /api/counselling/proforma
// Body: { session_id } — creates a proforma invoice from a counselling session
//
// PATCH /api/counselling/proforma
// Body: { invoice_id, action: "approve" | "expire" }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { session_id: string };
    if (!body.session_id) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const { data: invoiceId, error } = await supabase.rpc("create_proforma_from_session", {
      p_session_id: body.session_id,
      p_actor_id:   user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, invoice_id: invoiceId });
  } catch (err) {
    console.error("[counselling/proforma POST]", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { invoice_id: string; action: "approve" | "expire" };
    if (!body.invoice_id || !body.action) {
      return NextResponse.json({ error: "invoice_id and action required" }, { status: 400 });
    }

    if (body.action === "approve") {
      const { error } = await supabase
        .from("pending_invoices")
        .update({
          proforma_status:     "approved",
          proforma_approved_by: user.id,
          proforma_approved_at: new Date().toISOString(),
        })
        .eq("id", body.invoice_id)
        .eq("invoice_type", "proforma");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "approved" });
    }

    if (body.action === "expire") {
      const { error } = await supabase
        .from("pending_invoices")
        .update({ proforma_status: "expired" })
        .eq("id", body.invoice_id)
        .eq("invoice_type", "proforma");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "expired" });
    }

    return NextResponse.json({ error: "Invalid action. Use approve or expire" }, { status: 400 });
  } catch (err) {
    console.error("[counselling/proforma PATCH]", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
