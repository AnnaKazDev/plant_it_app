# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-22

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | User saves an action (e.g. watering) but it never appears on the plant card or plant-list teaser | High | High | interview Q1, interview Q4; hot-spot dir `src/lib` (70 commits/30d); hot-spot dir `src/components/plants` (58 commits/30d) |
| 2 | Weather data fails silently in production (missing Worker secret, timeout) while dev works; user sees wrong or missing weather on teasers | High | Medium | interview Q2, interview Q3; PRD NFR (weather error handling); hot-spot dir `src/lib` (70 commits/30d) |
| 3 | Logged-in user reads or mutates another user's plant, action, or photo (RLS / ownership gap) | High | Medium | PRD FR-003, guardrails (photos private); tech-stack.md (Supabase auth + RLS) |
| 4 | Photo upload succeeds but the action teaser still shows a placeholder — photo not linked or not returned in read path | Medium | High | PRD FR-007, FR-011; hot-spot dir `src/pages/api/photos` (7 commits/30d) |
| 5 | Plant list shows wrong, stale, or empty last-action teaser (ordering, join, or planned-action badge wrong) | Medium | Medium | roadmap S-04 risk note; interview Q1; hot-spot dir `src/components/plants` (58 commits/30d) |
| 6 | Server accepts invalid or abusive action input (oversized custom name, bad dates, type confusion) without proper rejection | Medium | Medium | PRD FR-007 (300-char action name, max 5 photos); abuse lens (untrusted input) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | After `POST` action, plant card and list teaser both show the new action (name, date, teaser media) for the owning user | "API returned 201" implies UI read path is correct | Action create entry point, persistence shape, query/helper used for card vs list, ordering rules for "last" action | integration (API + DB read-back, optionally page data loader) | Happy-path-only POST assert; mocking DB so insert never verified; asserting response body copied from handler without read-back |
| #2 | When weather API is unavailable or misconfigured, action still saves and user sees explicit degradation — not fake or silent success | "Weather optional" means any outcome is fine | Weather client boundary, env var presence on Workers, error translation on action create, what teaser displays when weather is null | integration with HTTP mock at weather edge | Oracle copied from weather parser implementation; e2e against live WeatherAPI.com |
| #3 | User A cannot `GET`/`DELETE`/`PATCH` user B's plant, action, or photo URL even when authenticated | "Middleware requires login" implies row-level ownership | Auth session shape, RLS policies, API route ownership checks, storage object paths | integration against local Supabase with two users | Only testing unauthenticated 401; testing with service-role client instead of user session |
| #4 | Action with uploaded photo(s) returns teaser image on card and list — not perpetual placeholder | Upload 200 means row exists in photos table | Upload API, photo–action association, read path for first teaser image, max-5 enforcement | integration (upload + action create + read) | Testing upload in isolation without action association; snapshot of placeholder component |
| #5 | With multiple actions (past and future), list shows correct last *completed* action teaser and planned-action badge/count | List shows "an" action — not necessarily the right one | Last-action query, date/timezone handling, planned vs historical split, badge rules | integration | Asserting list length only; brittle ordering by created_at when product uses action date |
| #6 | Oversized custom action name, invalid date, or >5 photos rejected with clear 4xx — no partial corrupt rows | Client-side validation exists | Zod/schema on action create and photo upload APIs, DB constraints | integration (API contract) | Testing only client form validation; mirror production zod in test as oracle |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path action + auth integration | Prove action create persists and surfaces on card/list read paths; defend ownership boundaries | #1, #3, #6 | integration | implemented | testing-critical-path-action-auth |
| 2 | Weather and photo boundary tests | Catch silent weather failures and photo–teaser drift at external/storage edges | #2, #4, #5 | integration | not started | — |
| 3 | Quality-gates wiring | Run integration suite in CI so regressions block merge | cross-cutting | gates | not started | — |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 4.1 | Node environment; `src/**/*.test.ts`; local Supabase forced in `test-setup.ts` |
| API mocking | manual fetch mock / test doubles | n/a | Mock at weather HTTP edge only; do not mock internal Supabase helpers |
| e2e | none yet | — | not justified until integration gaps close — see Phase 1 |
| accessibility | none yet | — | deferred; marketing pages explicitly out of scope (§7) |
| (optional) AI-native | none | n/a | not in rollout — deterministic integration gives better signal for current risks |

**Stack grounding tools (current session):**
- Docs: Context7 (`/vitest-dev/vitest`) — Vitest 4 integration patterns; checked: 2026-06-18
- Search: WebSearch MCP — available for tool status checks; not used this session; checked: 2026-06-18
- Runtime/browser: none — Playwright MCP not exposed; browser e2e not planned for Phase 1; checked: 2026-06-18
- Provider/platform: GitHub Actions (CI manifest read) — lint+build only today; Supabase local via `test-utils`; checked: 2026-06-18

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift |
| unit + integration | local + CI | required after §3 Phase 3 | logic regressions on critical paths |
| e2e on critical flows | CI on PR | planned | not scheduled — integration preferred for current risks |
| post-edit hook | local (agent loop) | planned | not in rollout |
| visual diff (deterministic) | CI on PR | planned | not in rollout |
| multimodal visual review | CI on PR | planned | not in rollout |
| pre-prod smoke | between merge + prod | optional | Workers env-specific failures (manual; secrets checklist) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

This project defers unit tests for API route contracts — handlers are thin and
integration tests give better signal for auth, RLS, and persistence. Extract
pure logic to `src/lib/` first, then add a colocated `*.test.ts` with Vitest.

### 6.2 Adding an integration test

**Prerequisites:** `npx supabase start` and `npm run dev` (separate terminal).

1. Place the file under `src/**/*.test.ts` (Vitest picks it up automatically).
2. Seed data with `seedTestData()` (single user) or `seedTwoUsers()` (RLS matrix).
3. Build auth headers with `buildTestAuthHeaders(user, apiUrl)` — mints a real
   JWT session and sets `X-Test-User-Id` for middleware.
4. `fetch` the running dev server at `process.env.API_URL ?? "http://localhost:4321"`.
5. For write→read scenarios (Risk #1), `POST` then `GET` card and list — do not
   stop at 201.
6. Clean up in `afterAll` with `cleanupTestData(userId)` (service role teardown).

**Reference files:** `critical-path.test.ts`, `ownership.test.ts`,
`test-utils.harness.test.ts`.

### 6.3 Adding an e2e test

- TBD — not scheduled in current rollout; prefer integration until §3 Phase 1–2 land.

### 6.4 Adding a test for a new API endpoint

1. **Happy path (owner):** authenticated user succeeds; assert response shape.
2. **Ownership (Risk #3):** second user gets **404** with `PLANT_NOT_FOUND` or
   `ACTION_NOT_FOUND` — production never returns 403 for wrong-owner access.
3. **Validation (Risk #6):** define PRD limits locally in the test file (do not
   import Zod schemas); assert 4xx and unchanged row counts via
   `getRowCounts(admin, { plantId })` or `createTestClient(true)` queries.
4. **Unauthenticated:** expect 401 (or middleware redirect in some routes).

### 6.5 Adding a test for weather or external HTTP boundary

- TBD — see §3 Phase 2 (mock at HTTP edge; assert degradation not silence).

### 6.6 Per-rollout-phase notes

**Phase 1 — Critical-path action + auth** (2026-07-22, change folder
`context/changes/testing-critical-path-action-auth/`): Risks #1, #3, #6 closed.
Patterns: POST→GET read-back (`critical-path.test.ts`), PRD-oracle validation
(`validation.test.ts`), user-scoped harness (`signInTestUser`, `buildTestAuthHeaders`),
two-user matrix (`ownership.test.ts`).

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Marketing / landing pages** (`Welcome.astro`, static copy) — low blast radius; visual/copy churn does not affect core tracking flows. Re-evaluate if landing becomes authenticated or collects PII. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-18
- Stack versions last verified: 2026-06-18
- AI-native tool references last verified: 2026-06-18

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
