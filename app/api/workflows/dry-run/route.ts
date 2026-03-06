import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conditions, trigger_key } = await req.json();

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Evaluate each condition against a sample context
    // In a real implementation this would use a real patient record.
    // Here we do a structural validation (field exists, operator is valid) and
    // return a meaningful dry-run result for the user to review.
    const SAMPLE_CONTEXT: Record<string, unknown> = {
      trigger: trigger_key ?? "appointment.completed",
      patient_status: "active",
      appointment_status: "completed",
      days_since_last_visit: 7,
      loyalty_tier: "Gold",
      invoice_total: 5000,
      no_show_count: 0,
    };

    const OPERATOR_LABELS: Record<string, string> = {
      eq:       "equals",
      neq:      "not equals",
      gt:       "greater than",
      lt:       "less than",
      gte:      "≥",
      lte:      "≤",
      contains: "contains",
      in:       "is one of",
      is_null:  "is empty",
    };

    const results = conditions.map((c: { field_path?: string; operator?: string; value?: unknown }) => {
      const fieldPath  = c.field_path  ?? "";
      const operator   = c.operator   ?? "eq";
      const value      = c.value;
      const opLabel    = OPERATOR_LABELS[operator] ?? operator;

      if (!fieldPath) {
        return { passed: false, reason: "Condition has no field defined" };
      }

      const sampleVal = SAMPLE_CONTEXT[fieldPath];

      // Evaluate with sample context
      let passed = false;
      try {
        switch (operator) {
          case "eq":       passed = sampleVal == value; break;
          case "neq":      passed = sampleVal != value; break;
          case "gt":       passed = Number(sampleVal) > Number(value); break;
          case "lt":       passed = Number(sampleVal) < Number(value); break;
          case "gte":      passed = Number(sampleVal) >= Number(value); break;
          case "lte":      passed = Number(sampleVal) <= Number(value); break;
          case "contains": passed = String(sampleVal ?? "").includes(String(value ?? "")); break;
          case "is_null":  passed = sampleVal == null || sampleVal === ""; break;
          default:         passed = false;
        }
      } catch { passed = false; }

      return {
        passed,
        reason: `${fieldPath} ${opLabel} "${String(value ?? "")}" → sample value is "${String(sampleVal ?? "not in sample")}"`,
      };
    });

    return NextResponse.json({ results });
  } catch (e) {
    console.error("dry-run error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
