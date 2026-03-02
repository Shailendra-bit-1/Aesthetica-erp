import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROLE_PERMISSIONS, type StaffRole } from "@/lib/permissions";

async function getSuperadminSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "superadmin") return null;
  return user;
}

export async function POST(request: NextRequest) {
  // Auth guard: superadmin only
  const caller = await getSuperadminSession();
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Service role key not configured." },
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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Create the auth user
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    });

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 400 });
  }

  const userId = created.user.id;

  // 2. Send a "set your password" recovery email
  await admin.auth.admin.generateLink({ type: "recovery", email });

  // 3. Create (or update) the profile with role + clinic_id
  const profilePayload: Record<string, unknown> = {
    id: userId,
    role,
    full_name: name,
    is_active: true,
  };
  if (clinicId) profilePayload.clinic_id = clinicId;

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileErr) {
    console.error("[invite-staff] profile upsert error:", profileErr.message);
  }

  // 4. Seed default permissions for this role
  const defaultPerms = ROLE_PERMISSIONS[role];
  const { error: permsErr } = await admin.from("user_permissions").upsert(
    {
      user_id: userId,
      use_custom: false,
      ...defaultPerms,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (permsErr) {
    console.error("[invite-staff] permissions upsert error:", permsErr.message);
  }

  return NextResponse.json({ success: true, userId });
}
