import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST { email: string, clinicId: string }
// Uses SUPABASE_SERVICE_ROLE_KEY for admin-level operations.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, clinicId } = body as { email: string; clinicId: string };

    if (!email || !clinicId) {
      return NextResponse.json(
        { success: false, error: "email and clinicId are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Search profiles table for this email
    const { data: existingProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, clinic_id, status")
      .eq("email", email)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json(
        { success: false, error: profileErr.message },
        { status: 500 }
      );
    }

    if (existingProfile) {
      // Found in profiles — update role, clinic_id, status
      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update({
          role: "clinic_admin",
          clinic_id: clinicId,
          status: "active",
        })
        .eq("id", existingProfile.id);

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: updateErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        created: false,
        isPlaceholder: false,
      });
    }

    // Step 2: Not in profiles — search auth.users
    const { data: authData, error: authListErr } =
      await supabaseAdmin.auth.admin.listUsers();

    if (authListErr) {
      return NextResponse.json(
        { success: false, error: authListErr.message },
        { status: 500 }
      );
    }

    const authUser = authData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (authUser) {
      // Found in auth.users — upsert profile
      const { error: upsertErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: authUser.id,
            email,
            role: "clinic_admin",
            clinic_id: clinicId,
            status: "active",
          },
          { onConflict: "id" }
        );

      if (upsertErr) {
        return NextResponse.json(
          { success: false, error: upsertErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        created: true,
        isPlaceholder: false,
      });
    }

    // Step 3: Not found anywhere — insert placeholder profile
    const placeholderId = crypto.randomUUID();

    const { error: insertErr } = await supabaseAdmin.from("profiles").insert({
      id: placeholderId,
      email,
      role: "clinic_admin",
      clinic_id: clinicId,
      status: "pending",
      full_name: null,
    });

    if (insertErr) {
      return NextResponse.json(
        { success: false, error: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: true,
      isPlaceholder: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
