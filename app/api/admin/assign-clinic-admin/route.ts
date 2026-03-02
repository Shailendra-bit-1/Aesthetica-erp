import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// POST { email: string, clinicId: string }
export async function POST(req: NextRequest) {
  // Auth guard: superadmin only
  const caller = await getSuperadminSession();
  if (!caller) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

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

    // Step 1: Search auth.users by email, then look up profile by user id
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
      // Found in auth.users — upsert profile (profiles has no email column)
      const { error: upsertErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: authUser.id,
            role: "clinic_admin",
            clinic_id: clinicId,
            is_active: true,
          },
          { onConflict: "id" }
        );

      if (upsertErr) {
        return NextResponse.json(
          { success: false, error: upsertErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, created: false, isPlaceholder: false });
    }

    // Step 2: Not found in auth.users — insert placeholder profile
    // (will be linked when user signs up with this email via magic link)
    const placeholderId = crypto.randomUUID();

    const { error: insertErr } = await supabaseAdmin.from("profiles").insert({
      id: placeholderId,
      role: "clinic_admin",
      clinic_id: clinicId,
      is_active: false,
      full_name: null,
    });

    if (insertErr) {
      return NextResponse.json(
        { success: false, error: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, created: true, isPlaceholder: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
