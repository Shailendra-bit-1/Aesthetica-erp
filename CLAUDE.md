# Aesthetica Clinic Suite — Developer Rules

## Stack
- **Framework**: Next.js 14 App Router (`"use client"` where needed)
- **Database**: Supabase (Postgres + RLS + Realtime)
- **Auth**: Supabase Auth (cookie-based via `@supabase/ssr`)
- **Styling**: Tailwind + inline styles — Linen & Gold theme
- **Theme**: `--gold: #C5A059`, bg `#F9F7F2`, serif: Georgia

---

## God Mode — Feature Flag Rules (MANDATORY)

> **All new modules MUST use `FeatureGate` and `checkFeature`.**
> **No feature is active by default unless explicitly enabled in God Mode.**

### Adding a new feature/module

1. **Register the feature slug** in `components/FeatureGate.tsx` under `FEATURE_META`.

2. **Seed the feature** in the `clinic_features` table (default `is_enabled = false`):
   ```sql
   INSERT INTO clinic_features (clinic_id, feature_slug, is_enabled, plan_tier)
   SELECT id, 'your_feature_slug', false, 'gold' FROM clinics
   ON CONFLICT (clinic_id, feature_slug) DO NOTHING;
   ```

3. **Wrap the UI** with `<FeatureGate>`:
   ```tsx
   import FeatureGate from "@/components/FeatureGate";

   <FeatureGate name="your_feature_slug">
     <YourFeatureComponent />
   </FeatureGate>
   ```

4. **Gate the API route** with `checkFeature`:
   ```ts
   import { checkFeature } from "@/lib/checkFeature";

   export async function GET(req: NextRequest) {
     const gate = await checkFeature(req, "your_feature_slug");
     if (gate) return gate; // 403 if not enabled
     // ... your handler
   }
   ```

5. **Add to `ALL_FEATURES`** in `app/admin/god-mode/page.tsx` so superadmins can toggle it.

---

## Security Rules

### RLS
- Every table MUST have RLS enabled.
- Use `auth.uid()` for user-scoped policies.
- Use `is_feature_enabled(clinic_id, feature_slug)` in RLS policies for feature-gated tables.
- Admins (`superadmin`, `chain_admin`, `clinic_admin`) always bypass feature gates.

### Audit Logging
- Every destructive or sensitive action MUST call `logAction()` from `lib/audit.ts`.
- Impersonation: all actions taken while impersonating log `impersonated_clinic_id` + `impersonated_clinic_name` in metadata.

### Never
- Never import `SUPABASE_SERVICE_ROLE_KEY` in `"use client"` components.
- Never skip RLS policies on new tables.
- Never expose user emails via `profiles` — email lives in `auth.users`.

---

## Data Access Patterns

### Profiles
- `profiles` has NO `email` column — email comes from `auth.users`.
- `ClinicContext` selects only `id, full_name, role, clinic_id`.
- Active staff filter: `.eq("is_active", true)` (NOT `.eq("status", "active")`).

### Clinic scoping
```ts
// Always scope queries to the active clinic
const scope = (q) => activeClinicId ? q.eq("clinic_id", activeClinicId) : q;
```

### Currency
- Always use `₹` (INR) and `en-IN` locale: `n.toLocaleString("en-IN")`.

### Arrays
- `primary_concern` in `patients` = `TEXT[]`. Insert as `[value]`, display as `arr[0]`.
- `allergies` in `patients` = `TEXT[]`.

---

## Role Hierarchy
```
superadmin > chain_admin > clinic_admin > doctor > therapist > counsellor > front_desk
```

- **superadmin**: bypass all gates, access God Mode, impersonate any clinic
- **chain_admin**: manage their chain's clinics
- **clinic_admin**: manage their clinic
- **staff**: access controlled by `role_permissions` + `user_overrides` + `clinic_features`

---

## Key Files

| Path | Purpose |
|------|---------|
| `lib/checkFeature.ts` | Server-side feature gate (use in API routes) |
| `components/FeatureGate.tsx` | Client-side feature gate component |
| `contexts/ImpersonationContext.tsx` | Superadmin impersonation state |
| `app/admin/god-mode/page.tsx` | God Mode dashboard |
| `app/admin/analytics/page.tsx` | Analytics dashboard |
| `lib/audit.ts` | HIPAA audit log helper |
| `lib/permissions.ts` | Role permission definitions |
| `contexts/ClinicContext.tsx` | Clinic + user profile context |
