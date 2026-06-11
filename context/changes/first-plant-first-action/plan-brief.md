# First Plant + First Action — Plan Brief

> Full plan: `context/changes/first-plant-first-action/plan.md`

## What & Why

Deliver the north-star slice (S-02): prove the core product hypothesis that a plant's visual story is photo + action + date + weather. A logged-in user adds their first plant (with optional photo and drag-and-drop grid placement), records their first action (with photos and date), and sees it on a plant card teaser — the smallest end-to-end flow that validates Plant It works.

## Starting Point

Foundations are implemented: database schema with plants/actions/photos, photo upload API for action photos, WeatherService (lat/lng + city validation), and extended registration storing `location_city` and garden dimensions. No plant/action APIs, pages, or UI exist yet. Dashboard is a placeholder. Weather and photo display were explicitly deferred from F-02/F-03 to this slice.

## Desired End State

User flow: Dashboard CTA → `/plants/new` (name, optional plant photo, drag marker on garden grid) → `/plants/[id]` (add action via combobox + date + up to 5 photos) → action teaser shows photo or placeholder, action name, date, weather or "Weather unavailable", Planned badge for future dates. Display name format: "Calendula (A3)". No plant list, edit/delete, or garden map yet.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Plant list in S-02 | No — card only | Matches roadmap tight scope; list deferred to S-04 | Plan |
| Weather coordinates | Query by `location_city` | No schema change; city already validated at signup | Plan |
| Grid input UX | Drag-and-drop on CSS grid | User sees garden layout; stores numeric x/y; scales to large gardens | Plan |
| Action dates | Past, today, and future | FR-008; Planned badge on card for future actions | Plan |
| Plant photo | New upload path `{user_id}/plants/{plant_id}/...` | FR-004 optional plant photo; separate from action photos | Plan |
| Photo display | Signed URLs at render time | Private bucket requires signing; reusable pattern | Plan |
| Weather failure | Save action; show fallback in teaser | PRD graceful degradation + F-03 pattern | Plan |
| Action name UI | Combobox (predefined or custom) | Single field, emoji from action_types | Plan |
| Post-create navigation | Redirect to `/plants/[id]` | Guides plant → action → teaser flow | Plan |
| Dashboard entry | Primary CTA "Add your first plant" | Clear onboarding for empty state | Plan |
| Edit/delete | None in S-02 | Create-only per roadmap | Plan |
| Future actions UI | "Planned" badge on teaser | Light FR-010 preview without list badges | Plan |
| API structure | Separate `/api/plants` and `/api/actions` | Matches domain model; photo upload stays action-scoped | Plan |
| Tests | API integration tests | Matches F-02 pattern; no UI automation | Plan |

## Scope

**In scope:**

- `POST/GET` plants API, `POST` actions API, `GET` action-types
- Weather-by-city on action create; signed URL helper; plant photo upload
- `/plants/new`, `/plants/[id]`, dashboard CTA
- React: GardenGridPicker (drag-drop), AddPlantForm, AddActionForm, ActionTeaser
- Integration tests for plant and action APIs

**Out of scope:**

- `/plants` list view (S-04), garden map (S-05), edit/delete
- Geocoding, lat/lng on profile, weather retry modal
- `additional_data` field UI, moon phase in teasers
- UI/browser automated tests

## Architecture / Approach

Backend-first: extend `storage.ts` and `weather.ts`, add REST APIs with zod validation and JSON errors (following `upload.ts`). Astro SSR pages load plant data server-side; React islands handle interactive forms. Action create then sequential photo uploads via existing `/api/photos/upload`. Grid helpers convert x/y ↔ "A3" labels for display.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Backend foundation | APIs, weather-by-city, signed URLs, plant photo path | Signed URL path parsing from stored URLs |
| 2. Add plant page | Drag-drop grid picker + optional plant photo | Large gardens (100×100) DOM size — may need scroll wrapper |
| 3. Plant card page | Teaser, combobox, multi-photo action form | shadcn component install + Astro/React boundary |
| 4. Dashboard + tests | Onboarding CTA, integration tests | Test env weather NULL without API key |

**Prerequisites:** F-01, F-02, F-03, S-01 complete; local Supabase for integration tests  
**Estimated effort:** ~3–4 implementation sessions across 4 phases

## Open Risks & Assumptions

- City-level weather is less precise than garden coordinates — acceptable for MVP
- 100×100m garden = 10,000 grid cells — UI may need scroll/zoom; not fully specced
- Storage RLS assumes `{user_id}/...` prefix; plant path `{user_id}/plants/...` assumed compatible without migration
- US-01 "appears in plant list" deferred to S-04 — intentional scope tradeoff

## Success Criteria (Summary)

- User completes signup → add plant → add action → sees teaser with photo/name/date/weather-or-fallback
- Integration tests pass for plant and action APIs
- `npm run lint`, `npm run check`, `npm run build` clean
