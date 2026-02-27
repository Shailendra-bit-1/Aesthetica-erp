import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ROLE_PERMISSIONS, type StaffRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "Service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.",
      },
      { status: 501 }
    );
  }

  const { name, email, role, clinicId } = (await request.json()) as {
    name: string;
    email: string;
    role: StaffRole;
    clinicId?: string;
  };

  if (!name || !email || !role) {
    return NextResponse.json(
      { error: "name, email and role are required" },
      { status: 400 }
    );
  }

  // Admin client — service role key, bypasses RLS
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. Create the auth user directly (account is live immediately) ──────────
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,          // confirmed — no manual signup step
      user_metadata: { full_name: name, role },
    });

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 400 });
  }

  const userId = created.user.id;

  // ── 2. Send a "set your password" recovery email ─────────────────────────────
  // The staff member gets an email with a link to choose their own password.
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  // ── 3. Create (or update) the profile with role + clinic_id ──────────────────
  const profilePayload: Record<string, unknown> = {
    id: userId,
    role,
    full_name: name,
    email,
    status: "active",
  };
  if (clinicId) profilePayload.clinic_id = clinicId;

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileErr) {
    // Non-fatal: log but don't fail the whole request
    console.error("[invite-staff] profile upsert error:", profileErr.message);
  }

  // ── 4. Seed default permissions for this role ─────────────────────────────────
  const defaultPerms = ROLE_PERMISSIONS[role];
  await admin.from("user_permissions").upsert(
    {
      user_id: userId,
      use_custom: false,
      ...defaultPerms,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return NextResponse.json({ success: true, userId });
}
