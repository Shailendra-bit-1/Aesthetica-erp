// Shared types for the patient profile tab system

export interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  preferred_provider: string | null;
  primary_concern: string[] | null;
  previous_injections: string | null;
  notes: string | null;
  clinic_id: string | null;
  created_at: string;
  date_of_birth: string | null;
  fitzpatrick_type: number | null;
  allergies: string[] | null;
  patient_tier: string | null;
  wallet_balance: number | null;
  is_blacklisted: boolean | null;
  blacklist_reason: string | null;
  blacklisted_at: string | null;
}

export interface MedicalHistory {
  id: string;
  primary_concerns: string[];
  preferred_specialist: string | null;
  had_prior_injections: boolean | null;
  last_injection_date: string | null;
  injection_complications: string | null;
  patient_notes: string | null;
  recorded_at: string;
  allergies: string[] | null;
  current_medications: string | null;
  past_procedures: string | null;
  skin_type: string | null;
}

export interface Encounter {
  id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  photos: { url: string; type: string; caption?: string }[];
  created_by_name: string | null;
  created_at: string;
  cpt_codes: string[] | null;
}

export interface PatientNote {
  id: string;
  note_type: string;
  content: string;
  author_name: string | null;
  created_at: string;
}

export interface Treatment {
  id: string;
  treatment_name: string;
  status: string;
  price: number | null;
  quoted_price: number | null;
  mrp: number | null;
  discount_pct: number | null;
  package_type: string | null;
  counselled_by: string | null;
  counselling_session_id: string | null;
  notes: string | null;
  created_at: string;
  recommended_sessions: number | null;
}

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  created_at: string;
}

export interface FaceChart {
  id: string;
  visit_date: string;
  diagram_type: string;
  annotations: PinAnnotation[];
  encounter_id: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface PinAnnotation {
  id: string;
  x: number; // percent of SVG width
  y: number; // percent of SVG height
  area: string;
  product: string;
  dose: string;
  depth: string;
  color: string;
  notes: string;
}

export interface ServiceCredit {
  id: string;
  service_name: string;
  total_sessions: number;
  used_sessions: number;
  purchase_price: number;
  per_session_value: number;
  status: string;
  family_shared: boolean;
  purchase_clinic_id: string;
  current_clinic_id: string;
  expires_at: string | null;
}

export interface PatientMembership {
  id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan: { name: string; duration_type: string; price: number } | null;
}

export interface Communication {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  content: string;
  status: string;
  sent_by_name: string | null;
  sent_at: string;
}

export const FITZPATRICK = [
  null,
  { label: "I",   desc: "Very fair",  bg: "#FFF5EC", text: "#8B6914", border: "#E8C87A" },
  { label: "II",  desc: "Fair",       bg: "#FFE4C4", text: "#7A5518", border: "#D4A870" },
  { label: "III", desc: "Medium",     bg: "#C8956A", text: "#3D1C02", border: "#A87048" },
  { label: "IV",  desc: "Olive",      bg: "#9E6840", text: "#FFF0E0", border: "#7A4E28" },
  { label: "V",   desc: "Brown",      bg: "#6B3E20", text: "#FAECD8", border: "#4A2810" },
  { label: "VI",  desc: "Dark",       bg: "#2D1505", text: "#E8D4C0", border: "#1A0800" },
];

export const TIER_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  standard: { label: "Standard",  bg: "rgba(120,130,140,0.1)", text: "#6B7280", border: "rgba(120,130,140,0.3)" },
  vip:      { label: "VIP",       bg: "rgba(197,160,89,0.12)", text: "#8B6914", border: "rgba(197,160,89,0.4)" },
  hni:      { label: "HNI",       bg: "rgba(139,126,200,0.12)", text: "#6B5FAA", border: "rgba(139,126,200,0.4)" },
};

export function calcAge(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0 || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age}y`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 4) return "••••••••";
  return `+•• ••••••${d.slice(-2)}`;
}

export function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain || !local) return "•••@•••";
  return `${local[0]}•••@${domain}`;
}
