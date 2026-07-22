# Critical-path action + auth integration — Plan Brief

> Full plan: `context/changes/testing-critical-path-action-auth/plan.md`
> Research: `context/changes/testing-critical-path-action-auth/research.md`

## What & Why

Rollout Phase 1 closes the highest-risk testing gaps: actions that save but never appear on card/list teasers (#1), cross-user data access despite login (#3), and server acceptance of abusive input (#6). Integration tests with DB read-back are the cheapest layer that gives real signal — not happy-path POST asserts or service-role harness shortcuts.

## Starting Point

Five Vitest integration test files exist; they `fetch` localhost with `X-Test-User-Id`, which forces a **service-role Supabase client** and bypasses RLS. Action POST tests assert 201 only. A cross-user photo upload test is skipped because the harness cannot prove ownership boundaries.

## Desired End State

Contributors run `npm run test:integration` and get: POST→GET proof on card and list (#1), 4xx + no orphan rows for invalid input (#6), and a two-user matrix proving 404/empty for cross-owner access (#3). The test-plan cookbook (§6) documents how to repeat these patterns.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Test layer | Integration (HTTP + DB) | Matches test-plan cost×signal; no e2e needed for these risks | Research |
| Sub-phase order | #1 → #6 → harness → #3 → §6 | High-signal cheap tests first; harness gates only ownership | Plan |
| Wrong-owner status | 404 `*_NOT_FOUND`, not 403 | App has no FORBIDDEN code; research corrected test-plan wording | Research |
| Harness fix | Anon key + user JWT session | Stops RLS bypass while keeping `fetch` integration style | Research |
| Validation oracle | PRD constants in test files | Avoids mirroring Zod from production code | Test plan |
| PATCH/DELETE scope | Cross-user rejection only | Risk #3 needs mutate denial; full happy-path suite deferred | Plan |
| FK bad `action_type_id` | Out of scope (500) | Not a 4xx validation case; document don't test | Research |

## Scope

**In scope:** Risk #1 read-back tests; Risk #6 boundary + DB count tests; harness fix in `test-utils` + `supabase.ts`; Risk #3 two-user matrix; §6 cookbook update.

**Out of scope:** CI gates (Phase 3), weather/photo teaser (Phase 2), e2e, marketing pages, fixing FK 500 on bad `action_type_id`.

## Architecture / Approach

Tests continue to call the dev server over HTTP. Phase 1–2 add scenarios with existing auth header. Phase 3 changes `createClient` so test requests use user-scoped JWT (RLS on). Phase 4 runs `seedTwoUsers()` + `signInTestUser()` through plants/actions/photos routes. Phase 5 writes patterns to `test-plan.md` §6.

```
POST /api/actions ──► GET /api/plants/[id]  (card actions[])
                 └──► GET /api/plants       (last_action)

User B + session ──► A's resources ──► 404 / empty (RLS)
Invalid input ──► 4xx ──► admin COUNT unchanged
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Read-back | POST→GET card + list (#1) | Wrong surface semantics (planned vs history) |
| 2. Validation | PRD boundaries + no orphan rows (#6) | Importing app Zod as oracle |
| 3. Harness | User-scoped client; RLS smoke | Breaking existing owner tests |
| 4. Ownership | Two-user GET/POST/PATCH/DELETE matrix (#3) | Accidental service-role in assertions |
| 5. Cookbook | §6.1/6.2/6.4/6.6 patterns | Docs drift from code |

**Prerequisites:** Local Supabase, `npm run dev`, `.dev.vars` / env secrets.
**Estimated effort:** ~2–3 focused sessions across 5 sub-phases.

## Open Risks & Assumptions

- `signInWithPassword` session minting works reliably in Node vitest against local Supabase (research open question #1 — chosen as cheaper than full cookie redirect flow).
- Existing owner tests pass after harness fix without rewriting every file to cookie auth.
- Dev server must be running for integration tests (unchanged; CI deferred).

## Success Criteria (Summary)

- New action on past/today date appears on both card `actions` and list `last_action` after POST.
- User B cannot read or mutate User A's plant, action, or photo when authenticated.
- Oversized name, bad date, and 6th photo return 4xx with unchanged DB row counts.
