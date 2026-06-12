<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: First Plant + First Action

- **Plan**: context/changes/first-plant-first-action/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Native controls instead of shadcn combobox/calendar

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/plants/AddActionForm.tsx
- **Detail**: Phase 3 specified shadcn Command/Popover/Calendar for action type and date. Implementation uses native `<select>` and `<input type="date">`. Functionally complete; UX differs from plan.
- **Fix A ⭐ Recommended**: Document as accepted simplification in plan addendum; defer shadcn combobox to S-03 polish.
  - Strength: Preserves working MVP; avoids large UI dependency surface.
  - Tradeoff: Plan UX spec not met until follow-up.
  - Confidence: HIGH — forms work and pass manual verification.
  - Blind spot: Accessibility comparison between native vs combobox not tested.
- **Fix B**: Install shadcn command/popover/calendar and refactor AddActionForm.
  - Strength: Matches plan UX spec.
  - Tradeoff: Non-trivial refactor; more bundle weight.
  - Confidence: HIGH — shadcn already used elsewhere in project.
  - Blind spot: Time to implement and retest full flow.
- **Decision**: FIXED via Fix A — plan addendum documents accepted simplification

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/plants/GardenGridPicker.tsx:95
- **Detail**: Renders one button per cell (`rows × cols`). Profile allows up to 100×100 m garden → 10k DOM nodes. Scroll container helps UX but not node count. Plan noted this risk.
- **Fix A ⭐ Recommended**: Cap picker at e.g. 50×50 with scroll + server-side bounds still enforced.
  - Strength: Bounded DOM; matches plan performance note.
  - Tradeoff: Users with >50 m gardens see subset in picker (still valid coords via drag at edge? need UX).
  - Confidence: MED — need to verify cap doesn't block valid placements.
  - Blind spot: Actual perf on mobile at max garden size.
- **Fix B**: Virtualize grid rendering for large gardens.
  - Strength: Supports full 100×100 without cap.
  - Tradeoff: Significant implementation effort for edge case.
  - Confidence: MED — virtualization with drag-drop is non-trivial.
  - Blind spot: None significant.
- **Decision**: SKIPPED

### F3 — Orphaned plant photo on DB update failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/plants/index.ts:164
- **Detail**: If `uploadPlantPhoto` succeeds but DB `update({ photo_url })` fails, handler returns 500 without deleting uploaded storage object. Upload-throw path correctly deletes plant row.
- **Fix**: On `updateError`, delete uploaded storage object via compensating cleanup before returning 500.
- **Decision**: FIXED — compensating storage + plant cleanup on updateError

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:9
- **Detail**: `X-Test-User-Id` header impersonates any user via service role when `!import.meta.env.PROD`. Preview/staging Workers run non-prod → potential auth bypass if header reachable externally.
- **Fix A ⭐ Recommended**: Restrict bypass to `import.meta.env.DEV` only (local Vitest/dev server).
  - Strength: Closes bypass on preview/staging deployments.
  - Tradeoff: Integration tests must run against local dev (already the case per AGENTS.md).
  - Confidence: HIGH — tests use local Supabase + dev server pattern.
  - Blind spot: CI pipeline env classification.
- **Fix B**: Require shared secret header alongside test user ID.
  - Strength: Allows bypass in controlled CI/staging with secret.
  - Tradeoff: More test setup complexity.
  - Confidence: MED — secret management in CI.
  - Blind spot: Secret rotation.
- **Decision**: FIXED via Fix A — bypass restricted to import.meta.env.DEV

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/weather.ts:46,120,196
- **Detail**: WeatherAPI calls use `http://` with API key in query string. Pre-existing from F-03; now on action-creation hot path via `POST /api/actions`.
- **Fix**: Change URLs to `https://api.weatherapi.com/...`.
- **Decision**: FIXED — weather API URLs switched to HTTPS

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/middleware.ts:36
- **Detail**: Unauthenticated requests to `/api/plants`, `/api/actions`, etc. get HTML sign-in redirect (302) instead of JSON 401. Handlers have 401 branches but middleware intercepts first. Tests accept `[302, 401]`.
- **Fix**: In middleware, return `Response.json({ error: ... }, { status: 401 })` for `/api/*` paths; keep redirects for page routes.
- **Decision**: FIXED — middleware returns JSON 401 for /api/* routes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/grid.ts:2
- **Detail**: `formatGridLabel` uses `String.fromCharCode(65 + grid_x)` — valid only for rows A–Z (grid_x 0–25). Gardens >26 m deep produce labels like `[27` instead of `AA27`.
- **Fix**: Add multi-letter row encoding (Excel-style) or document/cap `garden_height` at 26 m.
- **Decision**: FIXED — Excel-style multi-letter row labels in grid.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/plant-page.ts
- **Detail**: Plan allowed Supabase frontmatter or API; implementation uses dedicated `loadPlantCardPageData` loader. API route exists for tests/clients but plant card page bypasses it. Duplicates signed-URL signing logic.
- **Fix A ⭐ Recommended**: Accept as intentional SSR optimization; document in plan.
  - Strength: One round-trip, no self-HTTP; matches performance considerations in plan.
  - Tradeoff: Two code paths for same data shape.
  - Confidence: HIGH — common Astro SSR pattern.
  - Blind spot: Drift between loader and API response shape over time.
- **Fix B**: Refactor plant card to call GET /api/plants/[id] internally.
  - Strength: Single source of truth for plant card data.
  - Tradeoff: Extra HTTP hop or shared module extraction anyway.
  - Confidence: MED — may need shared query module regardless.
  - Blind spot: SSR fetch auth cookie forwarding.
- **Decision**: FIXED via Fix A — plan addendum documents intentional SSR loader pattern