/**
 * Aesthetica ERP — 50-concurrent-user stress test
 * Usage: node scripts/stress-test.mjs
 *
 * Tests: dashboard load · appointment booking · billing
 * Uses Supabase service role → no auth tokens required
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENT   = 50;
const RUNS_EACH    = 3; // repeat whole test N times for stability

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function ms(start) { return Date.now() - start; }
function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * p / 100)] ?? 0;
}
function stats(label, times) {
  const ok  = times.filter(t => t >= 0);
  const err = times.filter(t => t < 0).length;
  if (!ok.length) { console.log(`  ${label}: ALL FAILED (${err}/${times.length})`); return; }
  console.log(
    `  ${label}:  avg=${Math.round(ok.reduce((a,b)=>a+b,0)/ok.length)}ms` +
    `  p50=${pct(ok,50)}ms  p95=${pct(ok,95)}ms  p99=${pct(ok,99)}ms` +
    `  ok=${ok.length}/${times.length}  err=${err}`
  );
}

// ── Seed data (lookup once) ───────────────────────────────────────────────────
let seedClinicId, seedPatientId, seedServiceId, seedProviderId;
let seedServiceName;
async function loadSeedData() {
  const [clinic, patient, service, provider] = await Promise.all([
    sb.from("clinics").select("id").limit(1).single(),
    sb.from("patients").select("id").limit(1).single(),
    sb.from("services").select("id,name").limit(1).single(),
    sb.from("profiles").select("id").eq("is_active", true).limit(1).single(),
  ]);
  seedClinicId   = clinic.data?.id;
  seedPatientId  = patient.data?.id;
  seedServiceId  = service.data?.id;
  seedServiceName = service.data?.name ?? "Test Service";
  seedProviderId = provider.data?.id;

  if (!seedClinicId || !seedPatientId || !seedServiceId || !seedProviderId) {
    console.error("Seed data missing — run the demo clinic setup first.");
    process.exit(1);
  }
  console.log(`Seed: clinic=${seedClinicId.slice(0,8)} patient=${seedPatientId.slice(0,8)}`);
}

// ── Test scenarios ────────────────────────────────────────────────────────────

/** 1. Dashboard load — patients + today's appointments + recent invoices */
async function testDashboard() {
  const t = Date.now();
  const [p, a, i] = await Promise.all([
    sb.from("patients").select("id,full_name,primary_concern").eq("clinic_id", seedClinicId).limit(20),
    sb.from("appointments").select("id,start_time,status").eq("clinic_id", seedClinicId)
      .gte("start_time", new Date().toISOString().slice(0,10)).limit(50),
    sb.from("pending_invoices").select("id,total_amount,status").eq("clinic_id", seedClinicId).limit(10),
  ]);
  if (p.error || a.error || i.error) return -1;
  return ms(t);
}

/** 2. Appointment booking — insert via RPC (conflict-safe) */
async function testBookAppointment(i) {
  const t = Date.now();
  // Stagger times so they don't all conflict
  const hour = 9 + (i % 8);
  const startTime = new Date();
  startTime.setHours(hour, (i % 4) * 15, 0, 0);
  startTime.setDate(startTime.getDate() + 1);
  const endTime = new Date(startTime.getTime() + 30 * 60000);

  const { error } = await sb.rpc("create_appointment_safe", {
    p_clinic_id:   seedClinicId,
    p_patient_id:  seedPatientId,
    p_provider_id: seedProviderId,
    p_service_id:  seedServiceId,
    p_service_name: seedServiceName,
    p_start_time:  startTime.toISOString(),
    p_end_time:    endTime.toISOString(),
    p_notes:       `Stress test user ${i}`,
    p_status:      "planned",
  });
  if (error) return -1;
  return ms(t);
}

/** 3. Invoice creation — insert pending_invoice + line item */
async function testBilling(i) {
  const t = Date.now();
  const { data: inv, error: invErr } = await sb
    .from("pending_invoices")
    .insert({
      clinic_id:    seedClinicId,
      patient_name: `Stress Test Patient ${i}`,
      provider_id:  seedProviderId,
      provider_name: "Stress Provider",
      total_amount:  5000 + i * 10,
      payment_mode:  "cash",
      invoice_type:  "service",
    })
    .select("id")
    .single();
  if (invErr || !inv) return -1;

  const { error: liErr } = await sb.from("invoice_line_items").insert({
    invoice_id:  inv.id,
    clinic_id:   seedClinicId,
    service_id:  seedServiceId,
    description: `Stress test service ${i}`,
    quantity:    1,
    unit_price:  5000 + i * 10,
    gst_pct:     18,
    line_total:  5000 + i * 10,
  });
  if (liErr) return -1;
  return ms(t);
}

/** 4. Patient EMR fetch — simulates opening a patient record */
async function testPatientEMR() {
  const t = Date.now();
  const [patient, encounters, notes] = await Promise.all([
    sb.from("patients").select("*").eq("id", seedPatientId).single(),
    sb.from("clinical_encounters").select("id,subjective,assessment,created_at")
      .eq("patient_id", seedPatientId).order("created_at", { ascending: false }).limit(10),
    sb.from("patient_notes").select("id,content,note_type,created_at")
      .eq("patient_id", seedPatientId).limit(10),
  ]);
  if (patient.error) return -1;
  return ms(t);
}

// ── Runner ────────────────────────────────────────────────────────────────────
async function runScenario(label, fn, concurrency) {
  const tasks = Array.from({ length: concurrency }, (_, i) => fn(i));
  const results = await Promise.allSettled(tasks);
  const times = results.map(r => r.status === "fulfilled" ? r.value : -1);
  stats(label, times);
  return times;
}

async function runFullSuite(runNum) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Run #${runNum}  [${CONCURRENT} concurrent users]  ${new Date().toISOString()}`);
  console.log("─".repeat(60));

  const dashTimes = await runScenario("Dashboard Load      ", testDashboard, CONCURRENT);
  const bookTimes = await runScenario("Appointment Booking ", testBookAppointment, CONCURRENT);
  const billTimes = await runScenario("Invoice Creation    ", testBilling, CONCURRENT);
  const emrTimes  = await runScenario("Patient EMR Fetch   ", testPatientEMR, CONCURRENT);

  const allOk = [...dashTimes, ...bookTimes, ...billTimes, ...emrTimes].filter(t => t >= 0);
  const allTimes = [...dashTimes, ...bookTimes, ...billTimes, ...emrTimes];
  const errorRate = ((allTimes.length - allOk.length) / allTimes.length * 100).toFixed(1);

  console.log(`\n  Overall error rate: ${errorRate}%`);
  console.log(`  Total ops: ${allTimes.length}  |  p99 across all: ${pct(allOk, 99)}ms`);

  // ── Thresholds ──────────────────────────────────────────────────────────────
  const p95Dashboard = pct(dashTimes.filter(t=>t>=0), 95);
  const p95Booking   = pct(bookTimes.filter(t=>t>=0), 95);
  console.log("\n  Threshold check (p95 targets):");
  console.log(`    Dashboard  < 500ms:  ${p95Dashboard  < 500  ? "PASS" : "FAIL"} (${p95Dashboard}ms)`);
  console.log(`    Booking    < 1000ms: ${p95Booking   < 1000 ? "PASS" : "FAIL"} (${p95Booking}ms)`);
  console.log(`    Error rate < 1%:     ${parseFloat(errorRate) < 1 ? "PASS" : "FAIL"} (${errorRate}%)`);
}

// ── Cleanup stress-test data ──────────────────────────────────────────────────
async function cleanup() {
  // Remove invoices created by the stress test
  await sb.from("pending_invoices").delete().like("patient_name", "Stress Test Patient%");
  console.log("\n  Cleaned up stress-test invoices.");
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("Aesthetica ERP — Stress Test (50 concurrent users)");
console.log("=".repeat(60));

await loadSeedData();

for (let r = 1; r <= RUNS_EACH; r++) {
  await runFullSuite(r);
  if (r < RUNS_EACH) await new Promise(res => setTimeout(res, 2000)); // cool-down
}

await cleanup();
console.log("\nDone.");
