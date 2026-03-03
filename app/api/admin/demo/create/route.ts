/**
 * POST /api/admin/demo/create
 * Creates a demo clinic with comprehensive mock data across ALL modules:
 *   Staff · Patients · Services · Appointments · Invoices · Counselling
 *   CRM · Memberships · Inventory · Attendance · Payroll · Encounters
 * Superadmin only. Uses service role.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, appEnv } from "@/src/lib/config/environment";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const T = () => new Date();
function daysAgo(n: number) { const d = T(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function daysFromNow(n: number) { const d = T(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function todayStr() { return T().toISOString().slice(0, 10); }
function isoTs(date: string, hhmm: string) { return `${date}T${hhmm}:00`; }
function isoFull(date: string, hhmm: string) { return new Date(`${date}T${hhmm}:00+05:30`).toISOString(); }

// ─── Constants ────────────────────────────────────────────────────────────────

const STAFF_DEFS = [
  { full_name: "Dr. Meera Iyer",   role: "doctor",     basic_salary: 120000 },
  { full_name: "Ananya Krishnan",  role: "therapist",  basic_salary:  55000 },
  { full_name: "Ritu Sharma",      role: "counsellor", basic_salary:  45000 },
  { full_name: "Deepak Nair",      role: "front_desk", basic_salary:  35000 },
];

const PATIENT_DEFS = [
  { full_name: "Priya Sharma",   phone: "+91 98765 00001", email: "priya@demo.test",   primary_concern: ["Anti-aging"],          date_of_birth: "1985-03-14", fitzpatrick_type: 3, wallet_balance: 5000,  previous_injections: "Last treatment: 2025-11-10 · Complications: None", allergies: ["Penicillin"] },
  { full_name: "Arjun Mehta",    phone: "+91 98765 00002", email: "arjun@demo.test",   primary_concern: ["Acne treatment"],      date_of_birth: "1995-07-22", fitzpatrick_type: 4, wallet_balance: 0,     previous_injections: null, allergies: [] },
  { full_name: "Kavita Reddy",   phone: "+91 98765 00003", email: "kavita@demo.test",  primary_concern: ["Pigmentation"],        date_of_birth: "1990-11-05", fitzpatrick_type: 5, wallet_balance: 2000,  previous_injections: "Yes — prior chemical peel",                     allergies: [] },
  { full_name: "Rohan Desai",    phone: "+91 98765 00004", email: "rohan@demo.test",   primary_concern: ["Hair loss"],           date_of_birth: "1988-01-30", fitzpatrick_type: 3, wallet_balance: 0,     previous_injections: null, allergies: ["Sulfa drugs"] },
  { full_name: "Anjali Kapoor",  phone: "+91 98765 00005", email: "anjali@demo.test",  primary_concern: ["Skin brightening"],    date_of_birth: "1992-09-18", fitzpatrick_type: 2, wallet_balance: 8000,  previous_injections: null, allergies: [] },
  { full_name: "Siddharth Nair", phone: "+91 98765 00006", email: "sid@demo.test",     primary_concern: ["Botox consult"],       date_of_birth: "1980-04-12", fitzpatrick_type: 4, wallet_balance: 0,     previous_injections: "Last treatment: 2025-09-01 · Complications: Mild bruising", allergies: [] },
  { full_name: "Meena Pillai",   phone: "+91 98765 00007", email: "meena@demo.test",   primary_concern: ["Hydration"],           date_of_birth: "1998-06-25", fitzpatrick_type: 3, wallet_balance: 1500,  previous_injections: null, allergies: ["Latex"] },
  { full_name: "Vikram Shetty",  phone: "+91 98765 00008", email: "vikram@demo.test",  primary_concern: ["Scar treatment"],      date_of_birth: "1993-02-08", fitzpatrick_type: 4, wallet_balance: 0,     previous_injections: null, allergies: [] },
  { full_name: "Lakshmi Iyer",   phone: "+91 98765 00009", email: "lakshmi@demo.test", primary_concern: ["Anti-aging"],          date_of_birth: "1975-12-03", fitzpatrick_type: 4, wallet_balance: 12000, previous_injections: "Last treatment: 2026-01-15 · Complications: None", allergies: [] },
  { full_name: "Rahul Gupta",    phone: "+91 98765 00010", email: "rahul@demo.test",   primary_concern: ["Laser hair removal"],  date_of_birth: "1991-08-16", fitzpatrick_type: 3, wallet_balance: 0,     previous_injections: null, allergies: [] },
];

const SERVICE_DEFS = [
  { name: "Botox Treatment",          category: "Injectables",      duration_minutes: 45, mrp: 14000, selling_price: 12000, discount_pct: 14.3 },
  { name: "Dermal Fillers (1ml)",     category: "Injectables",      duration_minutes: 60, mrp: 22000, selling_price: 18000, discount_pct: 18.2 },
  { name: "Hydrafacial",              category: "Facial Treatments", duration_minutes: 75, mrp: 9500,  selling_price: 8000,  discount_pct: 15.8 },
  { name: "Chemical Peel (Medium)",   category: "Facial Treatments", duration_minutes: 45, mrp: 7000,  selling_price: 6000,  discount_pct: 14.3 },
  { name: "PRP Hair Treatment",       category: "Hair",              duration_minutes: 60, mrp: 18000, selling_price: 15000, discount_pct: 16.7 },
  { name: "Laser Hair Removal",       category: "Laser",             duration_minutes: 90, mrp: 12000, selling_price: 10000, discount_pct: 16.7 },
  { name: "Microneedling (Dermapen)", category: "Skin Treatments",   duration_minutes: 60, mrp: 9000,  selling_price: 7500,  discount_pct: 16.7 },
  { name: "Glutathione IV Drip",      category: "IV Therapy",        duration_minutes: 45, mrp: 10500, selling_price: 9000,  discount_pct: 14.3 },
];

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth guard ──────────────────────────────────────────────────────────
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
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const admin  = adminClient();
    const slug   = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const ts     = Date.now();
    const today  = todayStr();

    // Stronger password: upper+lower+digit+special, 14+ chars
    const randStr      = Math.random().toString(36).slice(2, 8).toUpperCase()
                       + Math.random().toString(36).slice(2, 5);
    const demoEmail    = `demo-${slug}-${ts}@aesthetica-demo.app`;
    const demoPassword = `Demo@${randStr}${Math.floor(10 + Math.random() * 90)}`;

    // ── 1. Create auth user ─────────────────────────────────────────────────
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: demoEmail, password: demoPassword, email_confirm: true,
      user_metadata: { full_name: `${name.trim()} Admin` },
    });
    if (authErr || !authUser?.user) {
      console.error("[demo/create] auth user error:", authErr);
      return NextResponse.json({ error: "Failed to create demo user" }, { status: 500 });
    }
    const authUserId = authUser.user.id;

    // ── 2. Create clinic ────────────────────────────────────────────────────
    const { data: clinic, error: clinicErr } = await admin.from("clinics").insert({
      name: name.trim(), admin_email: demoEmail,
      subscription_status: "active", subscription_plan: "enterprise",
      is_demo: true, demo_created_at: new Date().toISOString(),
      chain_id: callerProfile?.chain_id ?? null,
      location: "Demo City, India",
      monthly_revenue_target: 500000,
    }).select("id").single();
    if (clinicErr || !clinic) {
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.json({ error: "Failed to create clinic" }, { status: 500 });
    }
    const clinicId = clinic.id;

    // ── 3. Admin profile ────────────────────────────────────────────────────
    await admin.from("profiles").insert({
      id: authUserId, clinic_id: clinicId,
      chain_id: callerProfile?.chain_id ?? null,
      full_name: `${name.trim()} Admin`,
      role: "clinic_admin", is_active: true, basic_salary: 0,
    });

    // ── 4. Enable all modules ───────────────────────────────────────────────
    const { data: registry } = await admin.from("module_registry").select("module_key");
    if (registry?.length) {
      await admin.from("clinic_modules").upsert(
        registry.map((r: { module_key: string }) => ({ clinic_id: clinicId, module_key: r.module_key, is_enabled: true })),
        { onConflict: "clinic_id,module_key" }
      );
    }

    // ── 5a. Scheduler settings ──────────────────────────────────────────────
    // Must exist for the scheduler to function (upsert requires the row).
    await admin.from("scheduler_settings").upsert({
      clinic_id:             clinicId,
      enable_double_booking: false,
      buffer_time_minutes:   15,
      credit_lock:           true,
      working_start:         "09:00:00",
      working_end:           "21:00:00",
      slot_duration_minutes: 30,
    }, { onConflict: "clinic_id" });

    // ── 5b. User permissions for clinic admin ───────────────────────────────
    // clinic_admin gets full permissions (use_custom: false = role defaults applied)
    await admin.from("user_permissions").upsert({
      user_id: authUserId, use_custom: false, system_override: false,
      view_patients: true, edit_patients: true, view_scheduler: true,
      edit_scheduler: true, view_photos: true, edit_photos: true,
      view_inventory: true, view_revenue: true, edit_notes: true,
      view_medical: true, access_billing: true, delete_patient_photos: true,
      edit_staff: true,
    }, { onConflict: "user_id" });

    // ── 5c. Create staff auth users + profiles + permissions ─────────────────
    const staffIds: string[] = [];
    for (const s of STAFF_DEFS) {
      try {
        const { data: su } = await admin.auth.admin.createUser({
          email: `demo-${s.role}-${ts}@aesthetica-demo.app`,
          password: demoPassword, email_confirm: true,
          user_metadata: { full_name: s.full_name, role: s.role },
        });
        if (su?.user) {
          await admin.from("profiles").insert({
            id: su.user.id, clinic_id: clinicId,
            full_name: s.full_name, role: s.role,
            is_active: true, basic_salary: s.basic_salary,
          });
          // Seed role-default permissions (use_custom: false = role template used)
          const roleKey = s.role as keyof typeof ROLE_PERMISSIONS;
          const perms = ROLE_PERMISSIONS[roleKey] ?? {};
          await admin.from("user_permissions").upsert({
            user_id: su.user.id, use_custom: false, system_override: false,
            ...perms,
          }, { onConflict: "user_id" });
          staffIds.push(su.user.id);
        }
      } catch (e) { console.error(`[demo/create] staff ${s.role} error:`, e); }
    }
    const [doctorId, therapistId, counsellorId, frontDeskId] = staffIds;

    // ── 6. Patients ─────────────────────────────────────────────────────────
    const { data: patients } = await admin.from("patients").insert(
      PATIENT_DEFS.map(p => ({
        ...p,
        clinic_id: clinicId,
        chain_id: callerProfile?.chain_id ?? null,
        preferred_provider_id: doctorId ?? null,
        notes: "Demo patient — feel free to update.",
      }))
    ).select("id, full_name");
    const pIds  = (patients ?? []).map((p: { id: string }) => p.id);
    const pName = (i: number) => (patients ?? [])[i]?.full_name ?? "Patient";

    // ── 7. Services ─────────────────────────────────────────────────────────
    const { data: services } = await admin.from("services").insert(
      SERVICE_DEFS.map(s => ({
        ...s, clinic_id: clinicId, is_active: true,
        created_by: authUserId, description: `Demo ${s.name} service`,
      }))
    ).select("id, name, selling_price, duration_minutes");
    const sIds = (services ?? []).map((s: { id: string }) => s.id);
    const sName = (i: number) => (services ?? [])[i]?.name ?? "Service";
    const sPrice = (i: number) => (services ?? [])[i]?.selling_price ?? 0;

    // ── 8. Service packages ─────────────────────────────────────────────────
    try {
      const { data: pkgs } = await admin.from("service_packages").insert([
        { clinic_id: clinicId, name: "Glow Bundle",        description: "3× Hydrafacial + 2× Chemical Peel", total_price: 34000, mrp: 42500, discount_pct: 20, is_active: true, is_fixed: true, valid_days: 180, created_by: authUserId },
        { clinic_id: clinicId, name: "Anti-Aging Combo",   description: "Botox + Dermal Fillers",           total_price: 25000, mrp: 32000, discount_pct: 22, is_active: true, is_fixed: true, valid_days: 90,  created_by: authUserId },
      ]).select("id");
      if (pkgs?.length && sIds.length >= 4) {
        await admin.from("package_items").insert([
          { package_id: pkgs[0].id, service_id: sIds[2], sessions: 3 },
          { package_id: pkgs[0].id, service_id: sIds[3], sessions: 2 },
          { package_id: pkgs[1].id, service_id: sIds[0], sessions: 1 },
          { package_id: pkgs[1].id, service_id: sIds[1], sessions: 1 },
        ]);
      }
    } catch (e) { console.error("[demo/create] packages error:", e); }

    // ── 9. Appointments ─────────────────────────────────────────────────────
    try {
      const appts = [];
      // Past completed (last 28 days)
      const pastSlots = [
        { d: 25, p: 0, s: 0, hm: "10:00", dur: 45 },
        { d: 22, p: 1, s: 2, hm: "11:00", dur: 75 },
        { d: 20, p: 4, s: 3, hm: "14:00", dur: 45 },
        { d: 18, p: 2, s: 6, hm: "15:30", dur: 60 },
        { d: 15, p: 5, s: 0, hm: "09:30", dur: 45 },
        { d: 12, p: 8, s: 1, hm: "13:00", dur: 60 },
        { d: 10, p: 3, s: 4, hm: "10:30", dur: 60 },
        { d:  8, p: 9, s: 5, hm: "16:00", dur: 90 },
      ];
      for (const { d, p, s, hm, dur } of pastSlots) {
        if (!pIds[p] || !sIds[s]) continue;
        const ds = daysAgo(d);
        const endM = parseInt(hm.split(":")[1]) + dur;
        const endHH = parseInt(hm.split(":")[0]) + Math.floor(endM / 60);
        const endMM = endM % 60;
        appts.push({
          clinic_id: clinicId, patient_id: pIds[p], provider_id: doctorId ?? null,
          service_id: sIds[s], service_name: sName(s),
          start_time: isoFull(ds, hm),
          end_time:   isoFull(ds, `${String(endHH).padStart(2,"0")}:${String(endMM).padStart(2,"0")}`),
          status: "completed", credit_reserved: false,
        });
      }
      // Past no-shows
      if (pIds[6] && sIds[2]) appts.push({
        clinic_id: clinicId, patient_id: pIds[6], provider_id: therapistId ?? null,
        service_id: sIds[2], service_name: sName(2),
        start_time: isoFull(daysAgo(14), "11:00"),
        end_time:   isoFull(daysAgo(14), "12:15"),
        status: "no_show", credit_reserved: false,
      });
      if (pIds[7] && sIds[5]) appts.push({
        clinic_id: clinicId, patient_id: pIds[7], provider_id: therapistId ?? null,
        service_id: sIds[5], service_name: sName(5),
        start_time: isoFull(daysAgo(5), "14:00"),
        end_time:   isoFull(daysAgo(5), "15:30"),
        status: "no_show", credit_reserved: false,
      });
      // Today (planned)
      const todayAppts = [
        { p: 0, s: 0, hm: "10:00", dur: 45 },
        { p: 4, s: 2, hm: "12:00", dur: 75 },
        { p: 8, s: 1, hm: "15:00", dur: 60 },
      ];
      for (const { p, s, hm, dur } of todayAppts) {
        if (!pIds[p] || !sIds[s]) continue;
        const endM = parseInt(hm.split(":")[1]) + dur;
        const endHH = parseInt(hm.split(":")[0]) + Math.floor(endM / 60);
        const endMM = endM % 60;
        appts.push({
          clinic_id: clinicId, patient_id: pIds[p], provider_id: doctorId ?? null,
          service_id: sIds[s], service_name: sName(s),
          start_time: isoFull(today, hm),
          end_time:   isoFull(today, `${String(endHH).padStart(2,"0")}:${String(endMM).padStart(2,"0")}`),
          status: "planned", credit_reserved: false,
        });
      }
      // Future (planned)
      const futureSlots = [
        { d: 2, p: 1, s: 3, hm: "10:00", dur: 45 },
        { d: 3, p: 5, s: 0, hm: "11:30", dur: 45 },
        { d: 5, p: 2, s: 6, hm: "14:00", dur: 60 },
        { d: 7, p: 9, s: 4, hm: "09:00", dur: 60 },
        { d:10, p: 3, s: 5, hm: "15:00", dur: 90 },
      ];
      for (const { d, p, s, hm, dur } of futureSlots) {
        if (!pIds[p] || !sIds[s]) continue;
        const ds = daysFromNow(d);
        const endM = parseInt(hm.split(":")[1]) + dur;
        const endHH = parseInt(hm.split(":")[0]) + Math.floor(endM / 60);
        const endMM = endM % 60;
        appts.push({
          clinic_id: clinicId, patient_id: pIds[p], provider_id: doctorId ?? null,
          service_id: sIds[s], service_name: sName(s),
          start_time: isoFull(ds, hm),
          end_time:   isoFull(ds, `${String(endHH).padStart(2,"0")}:${String(endMM).padStart(2,"0")}`),
          status: "planned", credit_reserved: false,
        });
      }
      await admin.from("appointments").insert(appts);
    } catch (e) { console.error("[demo/create] appointments error:", e); }

    // ── 10. Invoices ────────────────────────────────────────────────────────
    const invoiceIds: string[] = [];
    try {
      const invoiceDefs = [
        { pi: 0, si: 0, status: "paid",    payment_mode: "card",   paid_dago: 20, due_dago: 25 },
        { pi: 4, si: 2, status: "paid",    payment_mode: "upi",    paid_dago: 15, due_dago: 18 },
        { pi: 8, si: 1, status: "paid",    payment_mode: "cash",   paid_dago:  8, due_dago: 10 },
        { pi: 2, si: 3, status: "paid",    payment_mode: "card",   paid_dago:  3, due_dago:  5 },
        { pi: 5, si: 0, status: "pending", payment_mode: null,     paid_dago: -1, due_dago: -7 },
        { pi: 6, si: 4, status: "overdue", payment_mode: null,     paid_dago: -1, due_dago: 15 },
        { pi: 9, si: 5, status: "pending", payment_mode: null,     paid_dago: -1, due_dago: -5 },
        { pi: 7, si: 6, status: "partial", payment_mode: "cash",   paid_dago: -1, due_dago: -3 },
      ];
      for (const { pi, si, status, payment_mode, paid_dago, due_dago } of invoiceDefs) {
        const pIdx = pi % (pIds.length || 1);
        const sIdx = si % (sIds.length || 1);
        const baseAmt = sPrice(sIdx);
        const gstAmt  = Math.round(baseAmt * 0.18);
        const total   = baseAmt + gstAmt;
        const { data: inv } = await admin.from("pending_invoices").insert({
          clinic_id:      clinicId,
          patient_name:   pName(pIdx),
          provider_id:    doctorId ?? null,
          provider_name:  "Dr. Meera Iyer",
          status,
          total_amount:   total,
          gst_pct:        18,
          discount_amount: 0,
          invoice_type:   "service",
          due_date:       due_dago > 0 ? daysAgo(due_dago) : daysFromNow(-due_dago),
          paid_at:        paid_dago > 0 ? new Date(new Date().setDate(new Date().getDate() - paid_dago)).toISOString() : null,
          payment_mode:   payment_mode,
        }).select("id").single();
        if (!inv?.id) continue;
        invoiceIds.push(inv.id);
        // Line item
        await admin.from("invoice_line_items").insert({
          invoice_id: inv.id, clinic_id: clinicId,
          service_id: sIds[sIdx] ?? null,
          description: sName(sIdx), quantity: 1,
          unit_price: baseAmt, discount_pct: 0,
          gst_pct: 18, line_total: total,
        });
        // Payment record for paid invoices
        if (status === "paid" && payment_mode) {
          await admin.from("invoice_payments").insert({
            invoice_id: inv.id, clinic_id: clinicId,
            amount: total, payment_mode, recorded_by: authUserId,
          });
        }
        // Partial payment
        if (status === "partial") {
          await admin.from("invoice_payments").insert({
            invoice_id: inv.id, clinic_id: clinicId,
            amount: Math.round(total * 0.5), payment_mode: "cash", recorded_by: authUserId,
          });
        }
      }
    } catch (e) { console.error("[demo/create] invoices error:", e); }

    // ── 11. Counselling sessions ────────────────────────────────────────────
    try {
      const sessionDefs = [
        { pi: 0, dago: 18, status: "converted", total_p: 30000, total_a: 30000, treatments: [{ name: "Botox Treatment", sessions: 1, price: 12000 }, { name: "Dermal Fillers (1ml)", sessions: 1, price: 18000 }] },
        { pi: 2, dago: 12, status: "converted", total_p: 22000, total_a: 15000, treatments: [{ name: "Hydrafacial", sessions: 3, price: 8000 }, { name: "Chemical Peel (Medium)", sessions: 1, price: 6000 }] },
        { pi: 4, dago:  5, status: "pending",   total_p: 18000, total_a: 0,     treatments: [{ name: "Glutathione IV Drip", sessions: 3, price: 9000 }] },
        { pi: 5, dago:  3, status: "partial",   total_p: 27000, total_a: 12000, treatments: [{ name: "PRP Hair Treatment", sessions: 3, price: 15000 }, { name: "Microneedling (Dermapen)", sessions: 2, price: 7500 }] },
        { pi: 8, dago:  8, status: "converted", total_p: 45000, total_a: 45000, treatments: [{ name: "Botox Treatment", sessions: 2, price: 12000 }, { name: "Dermal Fillers (1ml)", sessions: 2, price: 18000 }] },
        { pi: 3, dago: 20, status: "declined",  total_p: 15000, total_a: 0,     treatments: [{ name: "Laser Hair Removal", sessions: 3, price: 10000 }] },
      ];
      const counsellingInserts = sessionDefs
        .filter((_, i) => pIds[sessionDefs[i].pi])
        .map(({ pi, dago, status, total_p, total_a, treatments }) => ({
          clinic_id: clinicId, patient_id: pIds[pi],
          counsellor_id: counsellorId ?? null,
          session_date: daysAgo(dago),
          chief_complaint: PATIENT_DEFS[pi]?.primary_concern[0] ?? "General consultation",
          treatments_discussed: treatments,
          total_proposed: total_p, total_accepted: total_a,
          conversion_status: status,
          followup_date: status === "pending" ? daysFromNow(7) : null,
          notes: `Demo counselling session — ${status}`,
        }));
      if (counsellingInserts.length) {
        const { data: sessions } = await admin.from("counselling_sessions").insert(counsellingInserts).select("id, patient_id");
        // Seed patient_treatments from counselling
        if (sessions?.length) {
          const ptRows: Record<string, unknown>[] = [];
          for (const sess of sessions) {
            const def = sessionDefs.find(d => pIds[d.pi] === sess.patient_id);
            if (!def) continue;
            for (const t of def.treatments) {
              ptRows.push({
                patient_id: sess.patient_id, clinic_id: clinicId,
                treatment_name: t.name, status: def.status === "converted" ? "in_progress" : "proposed",
                price: t.price, quoted_price: t.price, counselled_by: "Ritu Sharma",
                counselling_session_id: sess.id,
                recommended_sessions: t.sessions,
              });
            }
          }
          if (ptRows.length) await admin.from("patient_treatments").insert(ptRows);
        }
      }
    } catch (e) { console.error("[demo/create] counselling error:", e); }

    // ── 12. CRM leads ───────────────────────────────────────────────────────
    try {
      await admin.from("crm_leads").insert([
        { clinic_id: clinicId, full_name: "Sneha Patel",     phone: "+91 90000 11001", email: "sneha@demo.test",  source: "meta_ads",    interest: ["Anti-aging", "Botox"],      status: "new",        assigned_to: counsellorId ?? null, next_followup: daysFromNow(1) },
        { clinic_id: clinicId, full_name: "Kiran Rao",       phone: "+91 90000 11002", email: "kiran@demo.test",  source: "google_ads",  interest: ["Hydrafacial"],              status: "contacted",  assigned_to: counsellorId ?? null, next_followup: daysFromNow(2) },
        { clinic_id: clinicId, full_name: "Divya Menon",     phone: "+91 90000 11003", email: "divya@demo.test",  source: "referral",    interest: ["Skin brightening", "Drip"], status: "interested", assigned_to: counsellorId ?? null, next_followup: daysFromNow(3) },
        { clinic_id: clinicId, full_name: "Abhishek Kumar",  phone: "+91 90000 11004", email: "abhi@demo.test",   source: "website",     interest: ["Hair loss", "PRP"],         status: "interested", assigned_to: doctorId    ?? null, next_followup: daysFromNow(2) },
        { clinic_id: clinicId, full_name: "Pooja Sharma",    phone: "+91 90000 11005", email: "pooja@demo.test",  source: "meta_ads",    interest: ["Fillers"],                  status: "converted",  assigned_to: counsellorId ?? null, patient_id: pIds[4] ?? null },
        { clinic_id: clinicId, full_name: "Rajan Nair",      phone: "+91 90000 11006", email: "rajan@demo.test",  source: "walk_in",     interest: ["Laser hair removal"],       status: "lost",       assigned_to: frontDeskId ?? null, notes: "Too expensive — chose competitor" },
        { clinic_id: clinicId, full_name: "Swati Gupta",     phone: "+91 90000 11007", email: "swati@demo.test",  source: "google_ads",  interest: ["Chemical peel", "Peel"],    status: "new",        assigned_to: counsellorId ?? null, next_followup: daysFromNow(1) },
        { clinic_id: clinicId, full_name: "Nikhil Verma",    phone: "+91 90000 11008", email: "nikhil@demo.test", source: "instagram",   interest: ["Botox", "Anti-aging"],      status: "contacted",  assigned_to: counsellorId ?? null, next_followup: daysFromNow(4) },
        { clinic_id: clinicId, full_name: "Anjana Pillai",   phone: "+91 90000 11009", email: "anj@demo.test",    source: "meta_ads",    interest: ["Microneedling", "Scars"],   status: "interested", assigned_to: therapistId ?? null, next_followup: daysFromNow(2) },
        { clinic_id: clinicId, full_name: "Rohit Singh",     phone: "+91 90000 11010", email: "rohit@demo.test",  source: "referral",    interest: ["Fillers", "Botox"],         status: "interested", assigned_to: counsellorId ?? null, next_followup: daysFromNow(5) },
        { clinic_id: clinicId, full_name: "Tanya Shah",      phone: "+91 90000 11011", email: "tanya@demo.test",  source: "website",     interest: ["Hydrafacial"],              status: "junk",       assigned_to: null },
        { clinic_id: clinicId, full_name: "Vishal Khanna",   phone: "+91 90000 11012", email: "vis@demo.test",    source: "google_ads",  interest: ["PRP", "Hair loss"],         status: "new",        assigned_to: doctorId ?? null, next_followup: todayStr() },
      ]);
      // Campaigns
      await admin.from("crm_campaigns").insert([
        { clinic_id: clinicId, name: "Feb Glow Offer — WhatsApp",    type: "whatsapp", status: "completed", sent_count: 142, delivered_count: 138, message_template: "Hi {name}! ✨ Get 20% off all facial treatments this February. Book now: {link}", scheduled_at: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString(), created_by: authUserId },
        { clinic_id: clinicId, name: "Post-Treatment Care Reminder",  type: "sms",     status: "running",   sent_count: 56,  delivered_count: 54,  message_template: "Hi {name}, your treatment at {clinic} is complete. Follow care instructions shared today. Call: {phone}", scheduled_at: new Date().toISOString(), created_by: authUserId },
        { clinic_id: clinicId, name: "Spring Rejuvenation Campaign",  type: "whatsapp", status: "draft",    sent_count: 0,   delivered_count: 0,   message_template: "Hi {name}! 🌸 Spring is here — treat yourself to a Hydrafacial + Peel combo at 25% off. Offer ends March 31.", scheduled_at: new Date(daysFromNow(5)).toISOString(), created_by: authUserId },
      ]);
    } catch (e) { console.error("[demo/create] crm error:", e); }

    // ── 13. Memberships ─────────────────────────────────────────────────────
    try {
      const { data: plans } = await admin.from("membership_plans").insert([
        { clinic_id: clinicId, name: "Silver",   duration_type: "monthly",  price: 999,  benefits: { discount: 5,  free_consultations: 1 }, is_active: true, is_global: false },
        { clinic_id: clinicId, name: "Gold",     duration_type: "quarterly", price: 2499, benefits: { discount: 10, free_consultations: 2, complimentary_hydrafacial: 1 }, is_active: true, is_global: false },
        { clinic_id: clinicId, name: "Platinum", duration_type: "annual",    price: 7999, benefits: { discount: 20, free_consultations: 6, complimentary_hydrafacial: 2, priority_booking: true }, is_active: true, is_global: false },
      ]).select("id");
      if (plans?.length && pIds.length >= 5) {
        await admin.from("patient_memberships").insert([
          { clinic_id: clinicId, patient_id: pIds[4], plan_id: plans[2].id, status: "active",  started_at: daysAgo(60),  expires_at: daysFromNow(305), auto_renew: true  },
          { clinic_id: clinicId, patient_id: pIds[2], plan_id: plans[1].id, status: "active",  started_at: daysAgo(30),  expires_at: daysFromNow(60),  auto_renew: false },
          { clinic_id: clinicId, patient_id: pIds[8], plan_id: plans[2].id, status: "active",  started_at: daysAgo(120), expires_at: daysFromNow(245), auto_renew: true  },
          { clinic_id: clinicId, patient_id: pIds[0], plan_id: plans[1].id, status: "expired", started_at: daysAgo(120), expires_at: daysAgo(30),      auto_renew: false },
        ]);
      }
      // Wallet transactions for patients with wallet_balance
      if (pIds.length >= 9) {
        await admin.from("wallet_transactions").insert([
          { clinic_id: clinicId, patient_id: pIds[0], type: "credit", amount: 5000,  balance_after: 5000,  reason: "Advance deposit",  reference_type: "manual" },
          { clinic_id: clinicId, patient_id: pIds[2], type: "credit", amount: 3000,  balance_after: 3000,  reason: "Wallet top-up",    reference_type: "manual" },
          { clinic_id: clinicId, patient_id: pIds[2], type: "debit",  amount: 1000,  balance_after: 2000,  reason: "Invoice payment",  reference_type: "invoice" },
          { clinic_id: clinicId, patient_id: pIds[4], type: "credit", amount: 10000, balance_after: 10000, reason: "Package advance",   reference_type: "manual" },
          { clinic_id: clinicId, patient_id: pIds[4], type: "debit",  amount: 2000,  balance_after: 8000,  reason: "Invoice payment",  reference_type: "invoice" },
          { clinic_id: clinicId, patient_id: pIds[6], type: "credit", amount: 1500,  balance_after: 1500,  reason: "Wallet top-up",    reference_type: "manual" },
          { clinic_id: clinicId, patient_id: pIds[8], type: "credit", amount: 15000, balance_after: 15000, reason: "Annual membership advance", reference_type: "manual" },
          { clinic_id: clinicId, patient_id: pIds[8], type: "debit",  amount: 3000,  balance_after: 12000, reason: "Invoice payment",  reference_type: "invoice" },
        ]);
      }
    } catch (e) { console.error("[demo/create] memberships error:", e); }

    // ── 14. Patient service credits ─────────────────────────────────────────
    try {
      if (pIds.length >= 5 && sIds.length >= 6) {
        await admin.from("patient_service_credits").insert([
          { patient_id: pIds[0], purchase_clinic_id: clinicId, current_clinic_id: clinicId, service_id: sIds[2], service_name: sName(2), total_sessions: 5, used_sessions: 2, purchase_price: 32000, per_session_value: 6400, status: "active", provider_id: therapistId ?? null, commission_pct: 10, expires_at: daysFromNow(150) },
          { patient_id: pIds[4], purchase_clinic_id: clinicId, current_clinic_id: clinicId, service_id: sIds[0], service_name: sName(0), total_sessions: 3, used_sessions: 1, purchase_price: 30000, per_session_value: 10000, status: "active", provider_id: doctorId ?? null, commission_pct: 8, expires_at: daysFromNow(90) },
          { patient_id: pIds[8], purchase_clinic_id: clinicId, current_clinic_id: clinicId, service_id: sIds[1], service_name: sName(1), total_sessions: 4, used_sessions: 2, purchase_price: 60000, per_session_value: 15000, status: "active", provider_id: doctorId ?? null, commission_pct: 8, expires_at: daysFromNow(120) },
          { patient_id: pIds[2], purchase_clinic_id: clinicId, current_clinic_id: clinicId, service_id: sIds[5], service_name: sName(5), total_sessions: 6, used_sessions: 0, purchase_price: 48000, per_session_value: 8000, status: "active",  provider_id: therapistId ?? null, commission_pct: 10, expires_at: daysFromNow(180) },
        ]);
      }
    } catch (e) { console.error("[demo/create] credits error:", e); }

    // ── 15. Inventory ────────────────────────────────────────────────────────
    try {
      const invDefs = [
        { name: "Botox (Allergan) 100U",    brand: "Allergan",       sku: "BOT-100", product_type: "consumable", category: "Injectables",    gst_rate: 12, mrp: 18000, selling_price: 15000, purchase_price: 12000, unit_of_measure: "vial",       units_per_pack: 1,   low_stock_threshold: 5,   reorder_quantity: 10,  qty: 18, batch_no: "B2601" },
        { name: "Juvederm Ultra (1ml)",     brand: "Allergan",       sku: "JUV-1ML", product_type: "consumable", category: "Injectables",    gst_rate: 12, mrp: 24000, selling_price: 20000, purchase_price: 16000, unit_of_measure: "syringe",    units_per_pack: 1,   low_stock_threshold: 3,   reorder_quantity: 10,  qty: 12, batch_no: "B2602" },
        { name: "Hydrafacial Serum Kit",    brand: "HydraFacial",    sku: "HF-SK01", product_type: "retail",     category: "Serums",         gst_rate: 18, mrp: 4500,  selling_price: 3800,  purchase_price: 2200,  unit_of_measure: "kit",        units_per_pack: 1,   low_stock_threshold: 10,  reorder_quantity: 20,  qty: 35, batch_no: "B2603" },
        { name: "AHA Peel Solution 30%",    brand: "Medik8",         sku: "AHA-30",  product_type: "consumable", category: "Peels",          gst_rate: 18, mrp: 3200,  selling_price: 2800,  purchase_price: 1800,  unit_of_measure: "bottle",     units_per_pack: 1,   low_stock_threshold: 8,   reorder_quantity: 15,  qty: 22, batch_no: "B2604" },
        { name: "SPF 50 Sunscreen",         brand: "La Roche-Posay", sku: "SPF-50",  product_type: "retail",     category: "Sun Protection", gst_rate: 18, mrp: 1800,  selling_price: 1600,  purchase_price: 1000,  unit_of_measure: "tube",       units_per_pack: 1,   low_stock_threshold: 20,  reorder_quantity: 30,  qty: 48, batch_no: "B2605" },
        { name: "Vitamin C Serum 20%",      brand: "Obagi",          sku: "VIT-C20", product_type: "retail",     category: "Serums",         gst_rate: 18, mrp: 5500,  selling_price: 4800,  purchase_price: 3200,  unit_of_measure: "bottle",     units_per_pack: 1,   low_stock_threshold: 10,  reorder_quantity: 15,  qty: 14, batch_no: "B2606" },
        { name: "Needles 30G × 4mm",        brand: "BD",             sku: "NDL-30G", product_type: "consumable", category: "Consumables",    gst_rate: 12, mrp: 12,    selling_price: 10,    purchase_price: 6,     unit_of_measure: "piece",      units_per_pack: 100, low_stock_threshold: 500, reorder_quantity: 1000,qty: 1200, batch_no: "B2607" },
        { name: "Topical Anaesthetic Cream",brand: "EMLA",           sku: "EMLA-5",  product_type: "consumable", category: "Consumables",    gst_rate: 18, mrp: 280,   selling_price: 250,   purchase_price: 180,   unit_of_measure: "tube",       units_per_pack: 1,   low_stock_threshold: 20,  reorder_quantity: 40,  qty: 38, batch_no: "B2608" },
        { name: "Retinol Night Cream 0.5%", brand: "SkinCeuticals",  sku: "RNC-05",  product_type: "retail",     category: "Moisturisers",   gst_rate: 18, mrp: 6200,  selling_price: 5500,  purchase_price: 3800,  unit_of_measure: "jar",        units_per_pack: 1,   low_stock_threshold: 8,   reorder_quantity: 12,  qty: 3,  batch_no: "B2609" },
        { name: "Dermapen Cartridges 0.5mm",brand: "Dermapen",       sku: "DPN-05",  product_type: "consumable", category: "Consumables",    gst_rate: 12, mrp: 350,   selling_price: 300,   purchase_price: 200,   unit_of_measure: "cartridge",  units_per_pack: 1,   low_stock_threshold: 20,  reorder_quantity: 50,  qty: 42, batch_no: "B2610" },
      ];
      const { data: invProds } = await admin.from("inventory_products").insert(
        invDefs.map(({ qty: _qty, batch_no: _b, ...p }) => ({ ...p, clinic_id: clinicId, is_active: true }))
      ).select("id");
      if (invProds?.length) {
        const batchRows = invProds.map((prod: { id: string }, i: number) => ({
          clinic_id: clinicId, product_id: prod.id,
          batch_number: invDefs[i].batch_no,
          quantity_received: invDefs[i].qty, quantity_remaining: invDefs[i].qty,
          purchase_price: invDefs[i].purchase_price,
          mrp: invDefs[i].mrp,
        }));
        const { data: batches } = await admin.from("inventory_batches").insert(batchRows).select("id, product_id");
        if (batches?.length) {
          await admin.from("inventory_movements").insert(
            batches.map((b: { id: string; product_id: string }, i: number) => ({
              clinic_id: clinicId, product_id: b.product_id, batch_id: b.id,
              movement_type: "receive", quantity: invDefs[i].qty,
              unit_cost: invDefs[i].purchase_price, performed_by_name: "Demo Setup",
            }))
          );
        }
      }
    } catch (e) { console.error("[demo/create] inventory error:", e); }

    // ── 16. Staff attendance (last 28 days) ─────────────────────────────────
    try {
      if (staffIds.length) {
        const attRows: Record<string, unknown>[] = [];
        for (let d = 1; d <= 28; d++) {
          const dateStr = daysAgo(d);
          const dow = new Date(dateStr).getDay(); // 0=Sun,6=Sat
          if (dow === 0 || dow === 6) continue;  // skip weekends
          for (let si = 0; si < staffIds.length; si++) {
            const isAbsent   = (d === 7  && si === 1) || (d === 14 && si === 2) || (d === 21 && si === 3);
            const isHalfDay  = (d === 11 && si === 0) || (d === 18 && si === 1);
            const isLate     = (d === 4  && si === 0) || (d === 9  && si === 2);
            const isOnLeave  = (d >= 24 && d <= 26 && si === 1);
            const clockIn    = isLate ? "10:30" : "09:00";
            const clockOut   = isHalfDay ? "13:30" : "18:00";
            attRows.push({
              clinic_id: clinicId, staff_id: staffIds[si], date: dateStr,
              clock_in:  isAbsent || isOnLeave ? null : isoTs(dateStr, clockIn),
              clock_out: isAbsent || isOnLeave ? null : isoTs(dateStr, clockOut),
              status:    isAbsent ? "absent" : isHalfDay ? "half_day" : isLate ? "late" : isOnLeave ? "on_leave" : "present",
            });
          }
        }
        await admin.from("staff_attendance").insert(attRows);
      }
    } catch (e) { console.error("[demo/create] attendance error:", e); }

    // ── 17. Staff leaves ─────────────────────────────────────────────────────
    try {
      if (staffIds.length >= 2) {
        await admin.from("staff_leaves").insert([
          { clinic_id: clinicId, staff_id: staffIds[1], leave_type: "sick",   from_date: daysAgo(26), to_date: daysAgo(24), status: "approved", approved_by: authUserId, reason: "Fever and rest" },
          { clinic_id: clinicId, staff_id: staffIds[3], leave_type: "casual", from_date: daysFromNow(5), to_date: daysFromNow(6), status: "pending", reason: "Personal work" },
          { clinic_id: clinicId, staff_id: staffIds[2], leave_type: "earned", from_date: daysFromNow(10), to_date: daysFromNow(12), status: "approved", approved_by: authUserId, reason: "Family function" },
        ]);
      }
    } catch (e) { console.error("[demo/create] leaves error:", e); }

    // ── 18. Payroll ──────────────────────────────────────────────────────────
    try {
      if (staffIds.length >= 4) {
        // February run (paid)
        const { data: febRun } = await admin.from("payroll_runs").insert({
          clinic_id: clinicId, period_start: "2026-02-01", period_end: "2026-02-28",
          status: "paid", total_gross: 255000, total_deductions: 12750, total_net: 242250,
          created_by: authUserId,
        }).select("id").single();
        if (febRun?.id) {
          await admin.from("payslips").insert([
            { clinic_id: clinicId, run_id: febRun.id, staff_id: staffIds[0], basic_salary: 120000, commission_total: 18500, allowances: 5000, deductions: 2000, tds: 8000, net_pay: 133500, attendance_days: 23, breakdown: { attendance_pct: 100, commission_details: "12 procedures × avg ₹1542" } },
            { clinic_id: clinicId, run_id: febRun.id, staff_id: staffIds[1], basic_salary: 55000,  commission_total: 8200,  allowances: 2000, deductions: 1000, tds: 2000, net_pay:  62200, attendance_days: 20, breakdown: { attendance_pct: 87,  leave_days: 3 } },
            { clinic_id: clinicId, run_id: febRun.id, staff_id: staffIds[2], basic_salary: 45000,  commission_total: 5500,  allowances: 1500, deductions: 500,  tds: 1500, net_pay:  50000, attendance_days: 22, breakdown: { attendance_pct: 96,  counselling_conversions: 5 } },
            { clinic_id: clinicId, run_id: febRun.id, staff_id: staffIds[3], basic_salary: 35000,  commission_total: 0,     allowances: 1000, deductions: 500,  tds: 1000, net_pay:  34500, attendance_days: 21, breakdown: { attendance_pct: 91 } },
          ]);
        }
        // March run (draft — current month)
        const { data: marRun } = await admin.from("payroll_runs").insert({
          clinic_id: clinicId, period_start: "2026-03-01", period_end: "2026-03-31",
          status: "draft", total_gross: 0, total_deductions: 0, total_net: 0,
          created_by: authUserId,
        }).select("id").single();
        if (marRun?.id) {
          await admin.from("payslips").insert([
            { clinic_id: clinicId, run_id: marRun.id, staff_id: staffIds[0], basic_salary: 120000, commission_total: 0, allowances: 5000, deductions: 2000, tds: 0, net_pay: 0, attendance_days: 1, breakdown: {} },
            { clinic_id: clinicId, run_id: marRun.id, staff_id: staffIds[1], basic_salary: 55000,  commission_total: 0, allowances: 2000, deductions: 1000, tds: 0, net_pay: 0, attendance_days: 1, breakdown: {} },
            { clinic_id: clinicId, run_id: marRun.id, staff_id: staffIds[2], basic_salary: 45000,  commission_total: 0, allowances: 1500, deductions: 500,  tds: 0, net_pay: 0, attendance_days: 1, breakdown: {} },
            { clinic_id: clinicId, run_id: marRun.id, staff_id: staffIds[3], basic_salary: 35000,  commission_total: 0, allowances: 1000, deductions: 500,  tds: 0, net_pay: 0, attendance_days: 1, breakdown: {} },
          ]);
        }
      }
    } catch (e) { console.error("[demo/create] payroll error:", e); }

    // ── 19. Clinical encounters (SOAP notes) ─────────────────────────────────
    try {
      if (pIds.length >= 5 && doctorId) {
        await admin.from("clinical_encounters").insert([
          { clinic_id: clinicId, patient_id: pIds[0], provider_id: doctorId, created_by_name: "Dr. Meera Iyer", subjective: "Patient presents for botox follow-up. Reports gradual improvement in forehead lines. Skin texture has improved. No adverse effects noted.", objective: "Forehead lines reduced by approximately 70%. No bruising or asymmetry. Ptosis absent. Patient appears satisfied.", assessment: "Excellent response to botulinum toxin. Lines softened as expected at 3-week mark.", plan: "Next session in 4 months. Continue SPF 50 daily. Recommend Retinol 0.5% nightly for enhanced anti-aging effect. Hydrafacial suggested in 6 weeks.", cpt_codes: ["11900", "99213"] },
          { clinic_id: clinicId, patient_id: pIds[1], provider_id: doctorId, created_by_name: "Dr. Meera Iyer", subjective: "22-year-old male with persistent comedonal and inflammatory acne across forehead and cheeks. Has tried OTC benzoyl peroxide with minimal response.", objective: "Moderate acne grade 2-3. Multiple open and closed comedones. No scarring at present.", assessment: "Moderate inflammatory acne vulgaris.", plan: "AHA chemical peel series of 4 sessions every 3 weeks. Prescribing topical adapalene 0.1% at night. SPF mandatory. Avoid oily products.", cpt_codes: ["99213"] },
          { clinic_id: clinicId, patient_id: pIds[2], provider_id: doctorId, created_by_name: "Dr. Meera Iyer", subjective: "Patient reports patchy hyperpigmentation on cheeks worsening after sun exposure. History of prior chemical peel 2 years ago.", objective: "Fitzpatrick type V. Melasma pattern — bilateral malar distribution. No erythema or active inflammation.", assessment: "Melasma — moderate severity. Patient suitable for combination therapy.", plan: "Glutathione IV drip series × 8, combined with topical kojic acid + arbutin. Strict photoprotection. Consider Q-switch laser after 2 months if inadequate response.", cpt_codes: ["99214"] },
          { clinic_id: clinicId, patient_id: pIds[8], provider_id: doctorId, created_by_name: "Dr. Meera Iyer", subjective: "50-year-old female requesting full facial rejuvenation. Primary concerns: jowling, tear trough hollowing, nasolabial folds, and dynamic forehead lines.", objective: "Moderate volume loss in mid-face. Deep nasolabial folds. Tear trough present bilaterally. Forehead rhytids with animation.", assessment: "Moderate to advanced facial aging. Ideal candidate for combination injectable protocol.", plan: "Botox 30U forehead + glabella. 1ml filler per side tear trough. 1ml filler nasolabial folds. Schedule 3-week review. Recommend HydraFacial monthly for maintenance.", cpt_codes: ["11900", "11901", "99214"] },
          { clinic_id: clinicId, patient_id: pIds[3], provider_id: doctorId, created_by_name: "Dr. Meera Iyer", subjective: "35-year-old male presenting with diffuse hair thinning on crown and frontal area for the past 18 months. Family history of androgenetic alopecia.", objective: "Hamilton-Norwood Type III. Thinning at vertex and frontotemporal recession. No scalp inflammation or seborrheic dermatitis.", assessment: "Early androgenetic alopecia. Good candidate for PRP therapy.", plan: "PRP hair injection series × 6 sessions at monthly intervals. Minoxidil 5% topical prescribed. Review at session 3 for progress assessment.", cpt_codes: ["99213"] },
        ]);
      }
    } catch (e) { console.error("[demo/create] encounters error:", e); }

    // ── 20. Notifications (demo bell data) ──────────────────────────────────
    try {
      const notifTs = (daysAgo: number, hhmm: string) => {
        const d = new Date(); d.setDate(d.getDate() - daysAgo);
        const [h, m] = hhmm.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      await admin.from("notifications").insert([
        { clinic_id: clinicId, type: "appointment", title: "Appointment booked",      body: "Botox Treatment on " + daysFromNow(3) + ", 11:00 AM",                                 entity_type: "appointment", action_url: "/scheduler",  is_read: false, created_at: notifTs(0, "09:15") },
        { clinic_id: clinicId, type: "payment",     title: "Payment received",        body: "₹12000 via UPI — Priya Sharma",                                                        entity_type: "invoice",     action_url: "/billing",    is_read: false, created_at: notifTs(0, "10:42") },
        { clinic_id: clinicId, type: "new_lead",    title: "New lead received",       body: "Rahul Verma via Meta Ads — interested in Botox",                                       entity_type: "lead",        action_url: "/crm",        is_read: false, created_at: notifTs(1, "14:05") },
        { clinic_id: clinicId, type: "low_stock",   title: "Low stock alert",         body: "Hyaluronic Acid Filler 1ml is running low (3 remaining)",                              entity_type: "product",     action_url: "/inventory",  is_read: true,  created_at: notifTs(2, "08:30") },
        { clinic_id: clinicId, type: "leave_request", title: "Leave request submitted", body: "Ananya Krishnan requested sick leave (2 days)",                                      entity_type: "leave",       action_url: "/staff",      is_read: true,  created_at: notifTs(2, "17:20") },
        { clinic_id: clinicId, type: "payment",     title: "Payment received",        body: "₹18000 via card — Lakshmi Iyer",                                                       entity_type: "invoice",     action_url: "/billing",    is_read: true,  created_at: notifTs(3, "11:55") },
        { clinic_id: clinicId, type: "appointment", title: "Appointment booked",      body: "PRP Hair Treatment on " + daysFromNow(7) + ", 10:00 AM",                               entity_type: "appointment", action_url: "/scheduler",  is_read: true,  created_at: notifTs(4, "16:00") },
        { clinic_id: clinicId, type: "new_lead",    title: "New lead received",       body: "Sneha Patel via website — interested in Laser Hair Removal",                           entity_type: "lead",        action_url: "/crm",        is_read: true,  created_at: notifTs(5, "09:45") },
      ]);
    } catch (e) { console.error("[demo/create] notifications error:", e); }

    // ── 21. Form definitions (portal forms) ─────────────────────────────────
    try {
      await admin.from("form_definitions").insert([
        {
          clinic_id: clinicId,
          name: "Patient Consent Form",
          form_type: "consent",
          is_active: true,
          fields: [
            { id: "consent_treatment",  type: "radio",    label: "I consent to the proposed aesthetic treatment(s) as discussed with my provider", required: true,  options: ["Yes, I consent", "No, I do not consent"] },
            { id: "consent_photos",     type: "radio",    label: "I consent to before/after photos being taken for medical records",                required: true,  options: ["Yes, I consent", "No, I do not consent"] },
            { id: "allergies_confirm",  type: "radio",    label: "I have disclosed all known allergies and current medications to the clinic",      required: true,  options: ["Confirmed", "I need to update my records"] },
            { id: "consent_signature",  type: "text",     label: "Full name (acts as digital signature)",                                           required: true },
            { id: "consent_date",       type: "date",     label: "Date",                                                                            required: true },
          ],
          branding: { accent: "#C5A059" },
          submit_action: { type: "save" },
        },
        {
          clinic_id: clinicId,
          name: "Post-Treatment Feedback",
          form_type: "feedback",
          is_active: true,
          fields: [
            { id: "overall_satisfaction", type: "radio",    label: "Overall satisfaction with your visit",             required: true,  options: ["Excellent", "Good", "Average", "Poor"] },
            { id: "treatment_result",     type: "radio",    label: "How satisfied are you with your treatment results?", required: true,  options: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"] },
            { id: "staff_rating",         type: "radio",    label: "How would you rate our staff's professionalism?",  required: true,  options: ["Excellent", "Good", "Average", "Needs improvement"] },
            { id: "recommend",            type: "radio",    label: "Would you recommend us to friends or family?",     required: true,  options: ["Definitely", "Probably", "Not sure", "No"] },
            { id: "comments",             type: "textarea", label: "Any additional comments or suggestions?",          required: false },
          ],
          branding: { accent: "#C5A059" },
          submit_action: { type: "save" },
        },
      ]);
    } catch (e) { console.error("[demo/create] form_definitions error:", e); }

    // ── 22. Magic link ──────────────────────────────────────────────────────
    const origin = req.headers.get("origin") ?? appEnv.baseUrl;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink", email: demoEmail,
      options: { redirectTo: `${origin}/` },
    });
    const loginUrl = linkData?.properties?.action_link ?? null;

    return NextResponse.json({
      clinicId, userId: authUserId,
      name: name.trim(), email: demoEmail, password: demoPassword, loginUrl,
      staffCount: staffIds.length,
      message: `Demo clinic created with ${staffIds.length} staff, 10 patients, 8 services, appointments, invoices, CRM leads, memberships, inventory, payroll, notifications & forms.`,
    });
  } catch (err) {
    console.error("[demo/create] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
