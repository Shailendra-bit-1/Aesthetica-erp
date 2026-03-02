/**
 * POST /api/admin/demo/create
 * Creates a demo clinic with a real auth user + all modules enabled.
 * Returns credentials so superadmin can share or log in directly.
 * Superadmin only. Uses service role.
 *
 * Body: { name: string }
 * Returns: { clinicId, email, password, loginUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, appEnv } from "@/src/lib/config/environment";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DEMO_PATIENTS = [
  { full_name: "Demo — Priya Sharma",    phone: "+91 98765 00001", primary_concern: ["Anti-aging"]       },
  { full_name: "Demo — Arjun Mehta",     phone: "+91 98765 00002", primary_concern: ["Acne treatment"]   },
  { full_name: "Demo — Kavita Reddy",    phone: "+91 98765 00003", primary_concern: ["Pigmentation"]     },
  { full_name: "Demo — Rohan Desai",     phone: "+91 98765 00004", primary_concern: ["Hair loss"]        },
  { full_name: "Demo — Anjali Kapoor",   phone: "+91 98765 00005", primary_concern: ["Skin brightening"] },
  { full_name: "Demo — Siddharth Nair",  phone: "+91 98765 00006", primary_concern: ["Botox consult"]    },
];

export async function POST(req: NextRequest) {
  try {
    // Verify superadmin
    const userClient = createServerClient(
      supabaseEnv.url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: callerProfile } = await userClient.from("profiles")
      .select("role, chain_id").eq("id", user.id).single();
    if (callerProfile?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden — superadmin only" }, { status: 403 });
    }

    const { name } = await req.json() as { name: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const admin = adminClient();
    const slug  = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const ts    = Date.now();

    // Generate credentials — stronger password (16 chars: upper+lower+digit+special)
    const demoEmail    = `demo-${slug}-${ts}@aesthetica-demo.app`;
    const randStr      = Math.random().toString(36).slice(2, 8).toUpperCase()
                       + Math.random().toString(36).slice(2, 5);
    const demoPassword = `Demo@${randStr}${Math.floor(10 + Math.random() * 90)}`;

    // 1. Create auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email:            demoEmail,
      password:         demoPassword,
      email_confirm:    true,
      user_metadata:    { full_name: `${name.trim()} Admin` },
    });
    if (authErr || !authUser?.user) {
      console.error("[demo/create] auth user error:", authErr);
      return NextResponse.json({ error: "Failed to create demo user" }, { status: 500 });
    }
    const authUserId = authUser.user.id;

    // 2. Create the demo clinic
    const { data: clinic, error: clinicErr } = await admin.from("clinics").insert({
      name:                name.trim(),
      admin_email:         demoEmail,
      subscription_status: "active",
      subscription_plan:   "enterprise",   // Full access for demos
      is_demo:             true,
      demo_created_at:     new Date().toISOString(),
      chain_id:            callerProfile?.chain_id ?? null,
    }).select("id").single();

    if (clinicErr || !clinic) {
      // Clean up auth user if clinic creation fails
      await admin.auth.admin.deleteUser(authUserId);
      console.error("[demo/create] clinic insert error:", clinicErr);
      return NextResponse.json({ error: "Failed to create clinic" }, { status: 500 });
    }
    const clinicId = clinic.id;

    // 3. Create clinic_admin profile for the demo user
    await admin.from("profiles").insert({
      id:        authUserId,
      clinic_id: clinicId,
      chain_id:  callerProfile?.chain_id ?? null,
      full_name: `${name.trim()} Admin`,
      role:      "clinic_admin",
      is_active: true,
    });

    // 4. Enable ALL modules for the demo clinic
    const { data: registry } = await admin.from("module_registry").select("module_key");
    if (registry?.length) {
      const moduleRows = registry.map((r: { module_key: string }) => ({
        clinic_id:  clinicId,
        module_key: r.module_key,
        is_enabled: true,
      }));
      await admin.from("clinic_modules").upsert(moduleRows, { onConflict: "clinic_id,module_key" });
    }

    // 5. Seed demo patients
    const patientRows = DEMO_PATIENTS.map(p => ({
      ...p,
      clinic_id: clinicId,
      chain_id:  callerProfile?.chain_id ?? null,
    }));
    await admin.from("patients").insert(patientRows);

    // 6. Generate a magic link so they can open it immediately.
    //    Use the request origin so the link redirects to the running server,
    //    not a hardcoded localhost fallback.
    const origin = req.headers.get("origin") ?? appEnv.baseUrl;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type:    "magiclink",
      email:   demoEmail,
      options: { redirectTo: `${origin}/` },
    });
    const loginUrl = linkData?.properties?.action_link ?? null;

    return NextResponse.json({
      clinicId,
      userId:   authUserId,
      name:     name.trim(),
      email:    demoEmail,
      password: demoPassword,
      loginUrl,
      message:  "Demo clinic created. Use the email/password or click Login As to access it.",
    });
  } catch (err) {
    console.error("[demo/create] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
