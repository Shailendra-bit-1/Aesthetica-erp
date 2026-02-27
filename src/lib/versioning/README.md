# Hook & API Versioning Contract

## Why we version hooks

When a new DB column is added (e.g. `tax_percent` to `services`) or a query
needs to be refactored, we do NOT change an existing versioned hook.
Instead, we create a **v2** alongside the existing **v1**.

This means:
- Pages that haven't been migrated continue to work with v1 data
- New features can consume v2 without breaking old pages
- We can deprecate v1 gradually and remove it after all pages migrate

---

## Rules

### 1. Explicit column lists — never `SELECT *`
```ts
// ✅ Schema-aware — new columns won't appear unexpectedly
const COLUMNS = "id, name, category, duration_minutes, selling_price";

// ❌ Breaks when new NOT NULL columns are added
.select("*")
```

### 2. All new DB columns must be optional in TypeScript types
```ts
export interface Service {
  id:            string;    // existing — required
  selling_price: number;    // existing — required
  mrp?:          number;    // v1.1 addition — optional
  tax_percent?:  number;    // v1.1 addition — optional
}
```

### 3. Version stamp every hook
```ts
export const HOOK_VERSION = "1.0.0" as const;
// Exported in return value so callers can log/debug which version is active
```

### 4. Version bump triggers
| Change type                        | Action                     |
|------------------------------------|----------------------------|
| Add optional column to type        | Keep v1, add to type as `?` |
| Change return shape                | Create v2 hook             |
| Breaking DB schema change          | Bump `schemaVersion` in env |
| New required field in DB            | Create v2 hook             |

### 5. Module index re-exports the active version
```ts
// src/modules/services/index.ts
export { useServicesV1 as useServices } from "./v1/hooks/useServicesV1";
// When v2 is ready:
// export { useServicesV2 as useServices } from "./v2/hooks/useServicesV2";
```
Consumers `import { useServices } from "@modules/services"` — they never
need to change when you bump from v1 to v2.

---

## Directory pattern for a new version

```
src/modules/services/
├── index.ts           ← re-export useServices from active version
├── v1/
│   ├── types.ts
│   └── hooks/
│       └── useServicesV1.ts
└── v2/                ← create when v2 is needed
    ├── types.ts       ← extends v1 types with new fields
    └── hooks/
        └── useServicesV2.ts
```

---

## Deprecation process

1. Create `v2/` hook
2. Update `index.ts` re-export to point to v2
3. Mark v1 hook with `@deprecated` JSDoc comment
4. After all pages are migrated to v2, delete v1/
