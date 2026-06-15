# Story 001: Supabase Project Setup

> **Epic**: Supabase
> **Status**: Complete
> **Layer**: Persistence — Foundation
> **Type**: Config + Infrastructure
> **Estimate**: S (3 hours)
> **Manifest Version**: 2026-05-29
> **Last Updated**: 2026-05-30
> **TR**: pending /architecture-review
> **ADR**: ADR-0004, ADR-0011

## Context

**GDD**: `design/gdd/supabase-integration.md`
**Requirements**: Prerequisite for all SUPA-AC-* (no AC maps directly; this story enables AC-01~AC-13)

**ADR Governing Implementation**: ADR-0011: Supabase Authentication and Data Sync Strategy; ADR-0008: CSP Headers
**ADR Decision Summary**: `createClient` lives exclusively in `src/lib/supabase.ts`. Only `src/stores/auth.ts` and `src/stores/data-sync.ts` import from it. `VITE_SUPABASE_URL` must be added to `connect-src` in `index.html` CSP meta tag (ADR-0008 consequence).

**Engine**: Web App — TypeScript | **Risk**: LOW
**Engine Notes**: `@supabase/supabase-js` is already listed in package.json (Phase 1 allowed libraries). No new package install needed — just verify it's present.

**Control Manifest Rules (Persistence Foundation)**:
- Required: `src/lib/supabase.ts` is the only file that calls `createClient()`
- Required: Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` sourced from `import.meta.env`
- Required: CSP `connect-src` in `index.html` includes the Supabase project URL pattern
- Forbidden: No service-role key anywhere in `src/` — anon key only
- Forbidden: No `createClient` calls in component files or composables

---

## Acceptance Criteria

- [ ] **AC-S1-01**: `src/lib/supabase.ts` exists and exports a single `supabase: SupabaseClient` instance created with `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`.
- [ ] **AC-S1-02**: `grep -r "createClient" src/ --include="*.ts"` matches only `src/lib/supabase.ts`.
- [ ] **AC-S1-03**: `.env.example` exists at repo root with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` placeholder lines (no real values).
- [ ] **AC-S1-04**: `index.html` CSP meta tag `connect-src` directive includes `https://*.supabase.co` (or the specific project URL pattern).
- [ ] **AC-S1-05**: `grep -r "SERVICE_ROLE" src/` returns zero matches.

---

## Implementation Notes

### Files to create / modify

```
src/lib/supabase.ts           ← new (createClient singleton)
.env.example                  ← new (placeholder vars)
index.html                    ← modify (add connect-src entry)
```

### supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)
```

### .env.example

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### index.html CSP update

Find the existing `connect-src` directive (or add one) and append `https://*.supabase.co wss://*.supabase.co`. The websocket entry covers Supabase Realtime (used by `onAuthStateChange`).

### Verify @supabase/supabase-js is installed

```
npm list @supabase/supabase-js
```

If missing: `npm install @supabase/supabase-js`.

---

## QA Test Cases

**Gate level**: ADVISORY (infrastructure story — no behavioral logic to unit-test)

- **AC-S1-02**: Run `grep -r "createClient" src/ --include="*.ts"` — must match exactly 1 line in `src/lib/supabase.ts`.
- **AC-S1-05**: Run `grep -r "SERVICE_ROLE" src/` — must return 0 matches.
- **AC-S1-04**: Open `index.html`, confirm `connect-src` includes supabase domain.

---

## Test Evidence

**Story Type**: Config + Infrastructure
**Required evidence**: Grep commands pass (ADVISORY — no unit test file needed)
**Manual evidence**: Dev server starts without TypeScript errors after adding `src/lib/supabase.ts`

---

## Dependencies

- Depends on: `@supabase/supabase-js` in package.json (Phase 1 allowed ✅)
- Unlocks: story-002-auth-store.md, story-003-migration.md (both need the client)

## Completion Notes
**Completed**: 2026-05-30
**Criteria**: 5/5 passing
**Deviations**: ADVISORY — `src/vite-env.d.ts` modified (out of stated scope) to add `ImportMetaEnv` interface; code review finding, valid improvement
**Test Evidence**: Config/Infrastructure story — all ACs verified via grep/file checks
**Code Review**: Complete — 2 findings fixed (`as string` casts removed; `ImportMetaEnv` interface added)
