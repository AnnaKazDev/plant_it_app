# Migrate Roadmap to GitHub Issues

## Status: Completed ✓

All tasks have been successfully executed:

- ✅ Authenticate GitHub CLI with browser OAuth flow
- ✅ Create 5 labels (foundation, slice, ready, blocked, roadmap)
- ✅ Create 3 milestones (MVP Foundations, Core Experience, Enhanced Tracking)
- ✅ Create F-01 issue: core-data-schema
- ✅ Create F-02 issue: photo-storage-setup
- ✅ Create F-03 issue: weather-api-integration
- ✅ Create S-01 issue: extended-registration (blocks on F-01)
- ✅ Create S-02 issue: first-plant-first-action (North Star, blocks on F-01/F-02/F-03/S-01)
- ✅ Create S-03 issue: multiple-actions-tracking (blocks on S-02)
- ✅ Create S-04 issue: plant-list-view (blocks on S-02)
- ✅ Create S-05 issue: garden-map-view (blocks on S-02)
- ✅ Update all blocked issues with actual prerequisite issue numbers

---

## Implementation Guide

### Prerequisites

#### Authenticate GitHub CLI

1. Run `gh auth login` to authenticate with your GitHub account
2. Requires browser-based OAuth flow
3. Verification: `gh auth status` should show logged in to `github.com`

---

### Step 1: Prepare GitHub Repository

#### Create Labels

Create 5 labels for categorizing issues:

- **foundation** (color: `0E8A16`, description: "Foundation work - infrastructure & setup")
- **slice** (color: `1D76DB`, description: "User-facing feature slice")
- **ready** (color: `0E8A16`, description: "Ready to implement - no blockers")
- **blocked** (color: `D93F0B`, description: "Blocked by dependencies")
- **roadmap** (color: `FBCA04`, description: "Derived from roadmap.md")

**Command:**
```bash
gh label create <name> --color <hex> --description <desc> --repo AnnaKazDev/plant_it_app
```

#### Create Milestones

Create 3 milestones for grouping work:

- **MVP Foundations** - Due: 2 weeks from now
- **Core Experience** - Due: 3 weeks from now
- **Enhanced Tracking** - Due: 4 weeks from now

**Command:**
```bash
gh issue create --milestone <name> --repo AnnaKazDev/plant_it_app
```

---

### Step 2: Create Foundation Issues (F-01, F-02, F-03)

These have no prerequisites and are marked as "ready".

#### F-01: core-data-schema

- **Title:** `[F-01] core-data-schema: Database schema for plants, actions, photos`
- **Labels:** `foundation`, `ready`, `roadmap`
- **Milestone:** MVP Foundations
- **Body:** Include outcome from `roadmap.md` lines 62-73
  - Outcome description
  - PRD references: FR-003, FR-012
  - Prerequisites: None
  - Risk: Schema design is foundational
  - Acceptance criteria (6 checklist items for tables, RLS, indexes)
  - Unlocks: S-01, S-02, and all other slices

#### F-02: photo-storage-setup

- **Title:** `[F-02] photo-storage-setup: Supabase Storage bucket + upload API`
- **Labels:** `foundation`, `ready`, `roadmap`
- **Milestone:** MVP Foundations
- **Body:** From `roadmap.md` lines 75-87
  - Outcome: Storage bucket, API helpers, RLS, max 5 photos validation
  - PRD references: NFR (privacy), FR-007
  - Unknowns: Free tier limits (50GB storage, 2GB bandwidth/month)
  - Acceptance criteria (5 items)
  - Unlocks: S-02, S-03, S-04

#### F-03: weather-api-integration

- **Title:** `[F-03] weather-api-integration: Historical weather fetch by date + coordinates`
- **Labels:** `foundation`, `ready`, `roadmap`
- **Milestone:** MVP Foundations
- **Body:** From `roadmap.md` lines 89-101
  - Outcome: Weather API client wrapper in `src/lib/weather.ts`
  - PRD references: FR-009, NFR
  - Unknowns: Weather API selection (recommend WeatherAPI.com)
  - Acceptance criteria (4 items for API wrapper, error handling)
  - Unlocks: S-02, S-03, S-04

---

### Step 3: Create Slice Issues with Dependencies (S-01 through S-05)

These have prerequisites and should be marked as "blocked" initially.

#### S-01: extended-registration

- **Title:** `[S-01] extended-registration: Location + garden dimensions during signup`
- **Labels:** `slice`, `blocked`, `roadmap`
- **Milestone:** Core Experience
- **Body:** From `roadmap.md` lines 105-116
  - Outcome: Register with email + password + location + garden dimensions
  - PRD references: FR-001, FR-012
  - Prerequisites: Reference F-01 issue number → Blocks on #\<F-01-number\>
  - Unknowns: Location input UX (city name vs coordinates)
  - Acceptance criteria (5 items)

#### S-02: first-plant-first-action

- **Title:** `[S-02] first-plant-first-action: Add plant + action with weather (North Star)`
- **Labels:** `slice`, `blocked`, `roadmap`
- **Milestone:** Core Experience
- **Body:** From `roadmap.md` lines 118-130
  - **North Star item** - most critical slice
  - Outcome: Add plant with photo + name + grid coords, add action with photos + date, see plant card with weather
  - PRD references: US-01, FR-004, FR-006, FR-007, FR-009, FR-011, FR-013
  - Prerequisites: Reference F-01, F-02, F-03, S-01 issue numbers
  - Risk: Most complex slice - touches all layers
  - Unknowns: Grid coordinate input UX, predefined action list
  - Acceptance criteria (7 items)

#### S-03: multiple-actions-tracking

- **Title:** `[S-03] multiple-actions-tracking: Track multiple actions per plant`
- **Labels:** `slice`, `blocked`, `roadmap`
- **Milestone:** Enhanced Tracking
- **Body:** From `roadmap.md` lines 132-142
  - Outcome: Add multiple actions (past/today/future), see all action teasers, planned actions badge
  - PRD references: FR-007, FR-008, FR-009, FR-010
  - Prerequisites: Reference S-02 issue number
  - Parallel with: S-04, S-05
  - Risk: Timezone handling for date logic
  - Acceptance criteria (4 items)

#### S-04: plant-list-view

- **Title:** `[S-04] plant-list-view: Multiple plants with last-action teasers`
- **Labels:** `slice`, `blocked`, `roadmap`
- **Milestone:** Enhanced Tracking
- **Body:** From `roadmap.md` lines 144-154
  - Outcome: Add multiple plants, see list with last-action teasers
  - PRD references: FR-005, FR-009
  - Prerequisites: Reference S-02 issue number
  - Parallel with: S-03, S-05
  - Risk: List performance with 10+ plants (bulk query needed)
  - Acceptance criteria (4 items)

#### S-05: garden-map-view

- **Title:** `[S-05] garden-map-view: Spatial grid layout with plant positions`
- **Labels:** `slice`, `blocked`, `roadmap`
- **Milestone:** Enhanced Tracking
- **Body:** From `roadmap.md` lines 156-167
  - Outcome: Garden map with plants at grid locations, click to open card
  - PRD references: FR-013, FR-014, FR-015
  - Prerequisites: Reference S-02 issue number
  - Parallel with: S-03, S-04
  - Unknowns: Map visualization approach (recommend CSS grid)
  - Risk: Keep simple - no drag-and-drop (per PRD Non-Goals)
  - Acceptance criteria (4 items)

---

### Step 4: Update Dependencies

After all issues are created:

1. Update each blocked issue's body to include actual issue numbers in prerequisite sections
2. Use GitHub's task list syntax: `- [ ] Blocks on #<issue-number>`
3. Remove `blocked` label and add `ready` label when all prerequisites are closed

---

## Execution Order

### Phase 1 (Parallel)
F-01, F-02, F-03 can be worked on simultaneously

### Phase 2
S-01 (after F-01 completes)

### Phase 3
S-02 (after F-01, F-02, F-03, S-01 complete) - **NORTH STAR**

### Phase 4 (Parallel)
S-03, S-04, S-05 (after S-02 completes)

---

## Implementation Notes

- Use `gh issue create` with `--title`, `--body`, `--label`, `--milestone`, `--repo` flags
- For body text, use heredoc syntax or save to temp file to avoid shell escaping issues
- All commands target `--repo AnnaKazDev/plant_it_app`
- Issue numbers will be assigned automatically and must be back-referenced
- Keep `roadmap.md` as source of truth - do not delete after migration
