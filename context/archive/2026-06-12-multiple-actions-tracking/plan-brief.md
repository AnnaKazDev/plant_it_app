# Multiple Actions Tracking — Plan Brief

> Full plan: `context/changes/multiple-actions-tracking/plan.md`

## What & Why

Roadmap slice S-03: confirm and harden multi-action tracking on the plant card. S-02 already lets users add unlimited actions with past/today/future dates and see Planned badges — this slice extracts shared date/sort logic, adds integration tests for multi-action scenarios, and closes scope gaps without UI redesign.

## Starting Point

S-02 (`first-plant-first-action`, status `impl_reviewed`) delivers `/plants/[id]` with `AddActionForm`, flat `ActionTeaser` list, newest-first sort, and Planned badge for future dates. Date helpers live privately in `ActionTeaser.tsx`; sort logic is duplicated in `plant-page.ts` and `GET /api/plants/[id]`. Integration tests cover single-action create only. No `/plants` list page — FR-010 list badges not started.

## Desired End State

User adds multiple actions on a plant card (unchanged UX) with confidence that ordering and Planned detection are consistent across SSR and API. Automated tests prove future/past date creation and GET returns actions newest-first. FR-010 plant-list badge/count explicitly deferred to S-04.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Primary deliverable | Polish & harden existing flow | S-02 already implements core multi-action loop | Plan |
| Action order | Newest first | Matches current behavior and S-02 API contract | Plan |
| FR-010 list badges | Defer to S-04 | No plant list page yet; keeps S-03 thin | Plan |
| Timeline UX | Flat teaser list | No visual timeline redesign needed | Plan |
| Planned detection | Browser local date | Simple, matches current `isPlannedAction` | Plan |
| Form controls | Keep native select + date input | Working MVP; shadcn deferred indefinitely | Plan |
| Edit/delete | None | Create-only per roadmap | Plan |
| Future weather | "Weather unavailable" | History API only; no forecast integration | Plan |
| Testing | Multi-action API + GET sort tests | Automates S-02 manual step 6 scenarios | Plan |

## Scope

**In scope:**

- `src/lib/action-dates.ts` — shared format, planned check, sort comparator
- Wire helpers into `ActionTeaser`, `plant-page.ts`, `plants/[id].ts`
- Extend `actions/index.test.ts` (future/past dates)
- New `plants/[id].test.ts` (multi-action sort)
- Manual multi-action verification checklist

**Out of scope:**

- `/plants` list view and FR-010 badges (S-04)
- Edit/delete actions, shadcn combobox/calendar
- Visual timeline, garden timezone, forecast weather
- Schema migration, UI automation

## Architecture / Approach

Thin hardening layer on S-02: extract `action-dates.ts` as single source for display/sort/planned logic; integration tests lock behavior. No new routes or schema. Plant card SSR loader pattern unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Shared action utilities | DRY date/sort helpers wired to UI + API | None — refactor only, behavior unchanged |
| 2. Integration test coverage | Future/past POST + multi-action GET sort tests | Test harness needs dev server + Supabase running |
| 3. Verification & close-out | Manual walkthrough + change metadata | Low — confirms no regression from refactor |

**Prerequisites:** S-02 complete; local Supabase for integration tests  
**Estimated effort:** ~1 session across 3 short phases

## Open Risks & Assumptions

- S-03 is intentionally thin because S-02 overshot "single action" scope — risk of slice feeling redundant; tests justify the change ID
- Browser-local "today" may differ from garden location at timezone boundaries — accepted for MVP
- `window.location.reload()` after add action remains — client refresh polish out of scope

## Success Criteria (Summary)

- User adds past/today/future actions; teasers ordered newest-first with Planned badge on future
- `npm run test:integration` covers multi-action + date scenarios
- `npm run lint`, `npm run check`, `npm run build` clean
