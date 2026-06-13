# Plant List View — Plan Brief

> Full plan: `context/changes/plant-list-view/plan.md`

## What & Why

Deliver roadmap slice S-04 (FR-005, FR-009, FR-010): users with multiple plants see a `/plants` list where each row summarizes the plant's latest care activity — photo, action, date, weather, and notes — plus a count of planned future actions. This completes the PRD journey step where Anna returns to see all plants at a glance after adding more than one.

## Starting Point

S-02/S-03 built plant create, plant card, multi-action timeline, and `ActionTeaser`. `POST /api/plants` and `GET /api/plants/[id]` exist; middleware protects `/plants`. No list page, no `GET /api/plants`, no list components, and dashboard only links to `/plants/new`.

## Desired End State

User clicks **View my plants** on dashboard → `/plants` shows all plants sorted by recent activity. Each row links to the plant card. Rows with actions show a last-action `ActionTeaser`; rows without show plant photo + name. Future actions surface as a `N planned` badge. Empty list shows a dedicated CTA to add the first plant. `GET /api/plants` integration tests pass.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Data loading | SSR loader + `GET /api/plants` | Matches plant card SSR pattern; API enables integration tests | Plan |
| Sort order | Most recent activity first | Surfaces plants you just cared for; uses last action date, not `updated_at` | Plan |
| Planned actions (FR-010) | Count badge (e.g. `2 planned`) | More informative than a dot when multiple future actions exist | Plan |
| Navigation | Dashboard CTA when plants exist | Clear path after first plant without expanding topbar yet | Plan |
| Empty list | Dedicated empty state on `/plants` | Consistent URL; no redirect magic | Plan |
| Notes on list | Show via full `ActionTeaser` | Reuses existing component; notes visible without opening card | Plan |
| Row interaction | Whole row links to plant card | Large tap target; standard list UX | Plan |
| Testing | `GET /api/plants` integration tests | Matches S-02/S-03 API test pattern | Plan |

## Scope

**In scope:**

- `fetchPlantListForUser` + `loadPlantListPageData` in `plant-page.ts`
- `GET /api/plants`
- `/plants` page, `PlantListContent`, `PlantListItem`
- Dashboard **View my plants** CTA
- Integration tests for list API

**Out of scope:**

- Garden map (S-05), edit/delete, search/pagination
- Topbar nav link, redirect-after-create to list
- Schema migration, thumbnail optimization, UI automation tests

## Architecture / Approach

Two bulk Supabase queries (plants, then actions by `plant_id`) aggregate last action and planned counts in JS. Signed URLs for plant avatar + last-action photo only. Astro SSR loads data; React island renders the list. `GET /api/plants` calls the same fetcher as the page loader.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Data layer | Shared fetcher, loader, `GET /api/plants` | Sort/planned-count logic must handle plants with no actions |
| 2. List UI | `/plants` page + row components | Empty state vs teaser layout consistency |
| 3. Navigation | Dashboard CTA, optional card back-link | Minor — mostly wiring |
| 4. Tests | Integration tests + full CI | Test seed data for multi-action + planned scenarios |

**Prerequisites:** S-02, S-03 complete; local Supabase for integration tests  
**Estimated effort:** ~2–3 implementation sessions across 4 phases

## Open Risks & Assumptions

- `plants.updated_at` does not bump on action create — sort uses last action date explicitly
- Loading all actions for all plants is acceptable for MVP volumes; separate query avoids nested over-fetch on plant row
- Browser-local timezone for planned dates matches S-03 accepted behavior

## Success Criteria (Summary)

- User sees all plants with last-action teasers and planned counts on `/plants`
- Dashboard links to list when user has plants
- `GET /api/plants` integration tests pass; lint, check, build clean
