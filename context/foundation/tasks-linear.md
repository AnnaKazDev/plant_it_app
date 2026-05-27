# Migrate Roadmap to Linear

## Status: Completed ✓

All tasks have been successfully executed:

- ✅ Authenticate Linear MCP server
- ✅ Create 5 labels (foundation, slice, ready, blocked, roadmap)
- ✅ Create 3 projects (MVP Foundations, Core Experience, Enhanced Tracking)
- ✅ Create F-01 issue: core-data-schema
- ✅ Create F-02 issue: photo-storage-setup
- ✅ Create F-03 issue: weather-api-integration
- ✅ Create S-01 issue: extended-registration (blocked by F-01)
- ✅ Create S-02 issue: first-plant-first-action (North Star, blocked by F-01/F-02/F-03/S-01)
- ✅ Create S-03 issue: multiple-actions-tracking (blocked by S-02)
- ✅ Create S-04 issue: plant-list-view (blocked by S-02)
- ✅ Create S-05 issue: garden-map-view (blocked by S-02)
- ✅ Set up blocking relationships between all dependent issues

**Migration Date:** May 27, 2026  
**Linear Workspace:** [plant-it](https://linear.app/plant-it)  
**Team:** Plant_it_app (Key: PLA)

---

## Implementation Summary

### Labels Created

All labels were created as workspace-level labels:

| Label | Color | Description |
|-------|-------|-------------|
| **foundation** | `#0E8A16` 🟢 | Foundation work - infrastructure & setup |
| **slice** | `#1D76DB` 🔵 | User-facing feature slice |
| **ready** | `#0E8A16` 🟢 | Ready to implement - no blockers |
| **blocked** | `#D93F0B` 🔴 | Blocked by dependencies |
| **roadmap** | `#FBCA04` 🟡 | Derived from roadmap.md |

### Projects Created

Projects in Linear serve as milestone/epic containers:

| Project | Icon | Target Date | Summary | URL |
|---------|------|-------------|---------|-----|
| **MVP Foundations** | 🌱 `:seedling:` | June 2026 | Foundation work - infrastructure & setup | [View](https://linear.app/plant-it/project/mvp-foundations-0d8099ae384c) |
| **Core Experience** | 🌿 `:herb:` | June 2026 | Core user-facing features | [View](https://linear.app/plant-it/project/core-experience-d4fbc2931641) |
| **Enhanced Tracking** | 🌳 `:deciduous_tree:` | June 2026 | Enhanced plant tracking capabilities | [View](https://linear.app/plant-it/project/enhanced-tracking-dfd6997a03e5) |

### Issues Created

#### Foundation Issues (Phase 1 - Ready to Start)

All foundation issues are marked as `ready` and have no blockers:

---

**[PLA-6](https://linear.app/plant-it/issue/PLA-6)** - [F-01] core-data-schema: Database schema for plants, actions, photos

- **Project:** MVP Foundations
- **Priority:** High
- **Labels:** foundation, ready, roadmap
- **Status:** Backlog
- **Prerequisites:** None
- **Git Branch:** `annakazmierczakit/pla-6-f-01-core-data-schema-database-schema-for-plants-actions`

**Description:**
```
## Outcome
Define and implement the complete database schema for plants, actions, and photos.

## PRD References
- FR-003, FR-012

## Risk
Schema design is foundational - changes later will be costly

## Acceptance Criteria
- [ ] Create plants table with all required fields
- [ ] Create actions table with all required fields
- [ ] Create photos table with all required fields
- [ ] Implement Row Level Security (RLS) policies
- [ ] Create necessary indexes for performance
- [ ] Document schema in migration file

## Unlocks
S-01, S-02, and all other slices
```

---

**[PLA-5](https://linear.app/plant-it/issue/PLA-5)** - [F-02] photo-storage-setup: Supabase Storage bucket + upload API

- **Project:** MVP Foundations
- **Priority:** High
- **Labels:** foundation, ready, roadmap
- **Status:** Backlog
- **Prerequisites:** None
- **Git Branch:** `annakazmierczakit/pla-5-f-02-photo-storage-setup-supabase-storage-bucket-upload-api`

**Description:**
```
## Outcome
Storage bucket, API helpers, RLS, max 5 photos validation

## PRD References
- NFR (privacy), FR-007

## Unknowns
Free tier limits (50GB storage, 2GB bandwidth/month)

## Acceptance Criteria
- [ ] Create Supabase Storage bucket
- [ ] Implement upload API helpers
- [ ] Set up RLS policies for storage
- [ ] Add validation for max 5 photos per entity
- [ ] Test upload/download functionality

## Unlocks
S-02, S-03, S-04
```

---

**[PLA-7](https://linear.app/plant-it/issue/PLA-7)** - [F-03] weather-api-integration: Historical weather fetch by date + coordinates

- **Project:** MVP Foundations
- **Priority:** High
- **Labels:** foundation, ready, roadmap
- **Status:** Backlog
- **Prerequisites:** None
- **Git Branch:** `annakazmierczakit/pla-7-f-03-weather-api-integration-historical-weather-fetch-by`

**Description:**
```
## Outcome
Weather API client wrapper in src/lib/weather.ts

## PRD References
- FR-009, NFR

## Unknowns
Weather API selection (recommend WeatherAPI.com)

## Acceptance Criteria
- [ ] Select and configure weather API provider
- [ ] Create API client wrapper in src/lib/weather.ts
- [ ] Implement historical weather fetch by date + coordinates
- [ ] Add error handling and retry logic

## Unlocks
S-02, S-03, S-04
```

---

#### Slice Issues (Phases 2-4 - Blocked by Dependencies)

All slice issues are marked as `blocked` initially:

---

**[PLA-8](https://linear.app/plant-it/issue/PLA-8)** - [S-01] extended-registration: Location + garden dimensions during signup

- **Project:** Core Experience
- **Priority:** Medium
- **Labels:** slice, blocked, roadmap
- **Status:** Backlog
- **Blocked By:** PLA-6 (F-01)
- **Git Branch:** `annakazmierczakit/pla-8-s-01-extended-registration-location-garden-dimensions-during`

**Description:**
```
## Outcome
Register with email + password + location + garden dimensions

## PRD References
- FR-001, FR-012

## Prerequisites
- Blocked by PLA-6 (F-01: core-data-schema)

## Unknowns
Location input UX (city name vs coordinates)

## Acceptance Criteria
- [ ] Extend registration form with location field
- [ ] Add garden dimensions input (width x length)
- [ ] Store user profile with location and dimensions
- [ ] Validate location format
- [ ] Update user profile schema
```

---

**[PLA-9](https://linear.app/plant-it/issue/PLA-9)** - [S-02] first-plant-first-action: Add plant + action with weather (North Star) 🎯

- **Project:** Core Experience
- **Priority:** Urgent ⚡
- **Labels:** slice, blocked, roadmap
- **Status:** Backlog
- **Blocked By:** PLA-6 (F-01), PLA-5 (F-02), PLA-7 (F-03), PLA-8 (S-01)
- **Git Branch:** `annakazmierczakit/pla-9-s-02-first-plant-first-action-add-plant-action-with-weather`

**Description:**
```
## 🎯 North Star Item
Most critical slice - touches all layers

## Outcome
Add plant with photo + name + grid coords, add action with photos + date, see plant card with weather

## PRD References
- US-01, FR-004, FR-006, FR-007, FR-009, FR-011, FR-013

## Prerequisites
- Blocked by PLA-6 (F-01: core-data-schema)
- Blocked by PLA-5 (F-02: photo-storage-setup)
- Blocked by PLA-7 (F-03: weather-api-integration)
- Blocked by S-01 (extended-registration)

## Risk
Most complex slice - touches all layers

## Unknowns
- Grid coordinate input UX
- Predefined action list

## Acceptance Criteria
- [ ] Create plant form with photo upload, name, grid coordinates
- [ ] Create action form with photo upload, date, type
- [ ] Display plant card with latest action
- [ ] Fetch and display weather data for action date
- [ ] Implement photo upload for both plants and actions
- [ ] Store grid coordinates
- [ ] Link actions to plants
```

---

**[PLA-10](https://linear.app/plant-it/issue/PLA-10)** - [S-03] multiple-actions-tracking: Track multiple actions per plant

- **Project:** Enhanced Tracking
- **Priority:** Medium
- **Labels:** slice, blocked, roadmap
- **Status:** Backlog
- **Blocked By:** PLA-9 (S-02)
- **Parallel With:** S-04, S-05
- **Git Branch:** `annakazmierczakit/pla-10-s-03-multiple-actions-tracking-track-multiple-actions-per`

**Description:**
```
## Outcome
Add multiple actions (past/today/future), see all action teasers, planned actions badge

## PRD References
- FR-007, FR-008, FR-009, FR-010

## Prerequisites
- Blocked by PLA-9 (S-02: first-plant-first-action)

## Parallel with
S-04, S-05

## Risk
Timezone handling for date logic

## Acceptance Criteria
- [ ] Allow adding multiple actions per plant
- [ ] Support past, present, and future action dates
- [ ] Display action teasers on plant card
- [ ] Show badge for planned actions
```

---

**[PLA-11](https://linear.app/plant-it/issue/PLA-11)** - [S-04] plant-list-view: Multiple plants with last-action teasers

- **Project:** Enhanced Tracking
- **Priority:** Medium
- **Labels:** slice, blocked, roadmap
- **Status:** Backlog
- **Blocked By:** PLA-9 (S-02)
- **Parallel With:** S-03, S-05
- **Git Branch:** `annakazmierczakit/pla-11-s-04-plant-list-view-multiple-plants-with-last-action`

**Description:**
```
## Outcome
Add multiple plants, see list with last-action teasers

## PRD References
- FR-005, FR-009

## Prerequisites
- Blocked by PLA-9 (S-02: first-plant-first-action)

## Parallel with
S-03, S-05

## Risk
List performance with 10+ plants (bulk query needed)

## Acceptance Criteria
- [ ] Create plant list view
- [ ] Display all plants for user
- [ ] Show last-action teaser for each plant
- [ ] Optimize bulk queries for performance
```

---

**[PLA-12](https://linear.app/plant-it/issue/PLA-12)** - [S-05] garden-map-view: Spatial grid layout with plant positions

- **Project:** Enhanced Tracking
- **Priority:** Medium
- **Labels:** slice, blocked, roadmap
- **Status:** Backlog
- **Blocked By:** PLA-9 (S-02)
- **Parallel With:** S-03, S-04
- **Git Branch:** `annakazmierczakit/pla-12-s-05-garden-map-view-spatial-grid-layout-with-plant`

**Description:**
```
## Outcome
Garden map with plants at grid locations, click to open card

## PRD References
- FR-013, FR-014, FR-015

## Prerequisites
- Blocked by PLA-9 (S-02: first-plant-first-action)

## Parallel with
S-03, S-04

## Unknowns
Map visualization approach (recommend CSS grid)

## Risk
Keep simple - no drag-and-drop (per PRD Non-Goals)

## Acceptance Criteria
- [ ] Create garden map view using CSS grid
- [ ] Display plants at their grid locations
- [ ] Click plant to open detail card
- [ ] Ensure simple implementation (no drag-and-drop)
```

---

## Execution Order

### Phase 1 (Parallel) - Foundation Work
**Start immediately, no blockers:**
- PLA-6 (F-01: core-data-schema) - Priority: High
- PLA-5 (F-02: photo-storage-setup) - Priority: High
- PLA-7 (F-03: weather-api-integration) - Priority: High

**Duration:** ~2 weeks (MVP Foundations milestone)

### Phase 2 - Extended Registration
**After PLA-6 completes:**
- PLA-8 (S-01: extended-registration) - Priority: Medium

### Phase 3 - North Star 🎯
**After PLA-6, PLA-5, PLA-7, and PLA-8 complete:**
- PLA-9 (S-02: first-plant-first-action) - Priority: Urgent
- **This is the most critical slice** - validates the entire app concept

**Duration:** ~3 weeks (Core Experience milestone)

### Phase 4 (Parallel) - Enhanced Features
**After PLA-9 completes:**
- PLA-10 (S-03: multiple-actions-tracking) - Priority: Medium
- PLA-11 (S-04: plant-list-view) - Priority: Medium
- PLA-12 (S-05: garden-map-view) - Priority: Medium

**Duration:** ~4 weeks (Enhanced Tracking milestone)

---

## Dependency Graph

```
F-01 (PLA-6) ─────┐
                  ├──→ S-01 (PLA-8) ─┐
F-02 (PLA-5) ─────┤                  │
                  ├──────────────────┼──→ S-02 (PLA-9) ──┬──→ S-03 (PLA-10)
F-03 (PLA-7) ─────┘                  │         🎯        ├──→ S-04 (PLA-11)
                                     │                   └──→ S-05 (PLA-12)
                                     └───────────────────┘

Legend:
─────→  Blocks/Dependencies
F-XX    Foundation issue (no blockers, ready to start)
S-XX    Slice issue (blocked by prerequisites)
🎯      North Star item (most critical)
```

---

## Technical Implementation Details

### Tools Used

- **Linear MCP Server:** `plugin-linear-linear`
- **Team ID:** `01ed559b-e2ea-4e96-9d6d-d2868245ecf7`
- **Team Key:** `PLA`

### MCP Tools Called

1. **Authentication:**
   ```
   CallMcpTool: mcp_auth (server: plugin-linear-linear)
   ```

2. **Labels Creation:**
   ```
   CallMcpTool: create_issue_label
   - foundation (#0E8A16)
   - slice (#1D76DB)
   - ready (#0E8A16)
   - blocked (#D93F0B)
   - roadmap (#FBCA04)
   ```

3. **Projects Creation:**
   ```
   CallMcpTool: save_project
   - MVP Foundations (target: 2026-06-30)
   - Core Experience (target: 2026-06-30)
   - Enhanced Tracking (target: 2026-06-30)
   ```

4. **Issues Creation:**
   ```
   CallMcpTool: save_issue (x8)
   - F-01, F-02, F-03 (with labels: foundation, ready, roadmap)
   - S-01, S-02, S-03, S-04, S-05 (with labels: slice, blocked, roadmap)
   ```

5. **Dependency Setup:**
   ```
   CallMcpTool: save_issue (with blockedBy parameter)
   - Set up blocking relationships between dependent issues
   - Linear automatically creates bidirectional "blocks/blocked by" relations
   ```

### Issue Metadata

Each issue includes:

- **Title:** Format `[ID] name: Description`
- **Description:** Markdown with Outcome, PRD refs, Prerequisites, Risk/Unknowns, Acceptance Criteria, Unlocks
- **Priority:** 1=Urgent (North Star), 2=High (Foundations), 3=Medium (Slices)
- **Project:** Assigned to appropriate milestone project
- **Labels:** Categorization (foundation/slice, ready/blocked, roadmap)
- **Blocking Relations:** Set via `blockedBy` parameter
- **Git Branches:** Auto-generated by Linear based on issue title
- **Status:** All issues start in "Backlog" status

### Label Management Strategy

**When to update labels:**

1. **Remove `blocked`, add `ready`** when all prerequisite issues are marked as complete
2. Keep `foundation` or `slice` label throughout lifecycle
3. Keep `roadmap` label to indicate source document

**Automatic state transitions:**

Linear automatically updates issue state when:
- All blocking issues are completed → Issue becomes unblocked
- Issue is started → Status changes from "Backlog" to "In Progress"
- Issue is completed → Status changes to "Done"

---

## Next Steps

### Immediate Actions

1. **Start Phase 1 (Foundation Work):**
   - Assign PLA-6, PLA-5, PLA-7 to team members
   - These can be worked on in parallel
   - Target completion: 2 weeks

2. **Monitor Progress:**
   - Use Linear's [Projects view](https://linear.app/plant-it) to track milestone progress
   - Watch for blocking relationships to auto-resolve as issues complete

3. **Update Labels:**
   - When F-01, F-02, F-03 complete, remove `blocked` label from dependent issues
   - Add `ready` label to unblocked issues

### Working with Linear

**View all issues:**
```
https://linear.app/plant-it
```

**Filter by label:**
- Foundation work: Filter by `foundation` label
- User slices: Filter by `slice` label
- Ready to work: Filter by `ready` label
- Blocked: Filter by `blocked` label

**View specific projects:**
- [MVP Foundations](https://linear.app/plant-it/project/mvp-foundations-0d8099ae384c)
- [Core Experience](https://linear.app/plant-it/project/core-experience-d4fbc2931641)
- [Enhanced Tracking](https://linear.app/plant-it/project/enhanced-tracking-dfd6997a03e5)

**Git Integration:**
- Each issue has an auto-generated git branch name
- Format: `annakazmierczakit/pla-{number}-{slug}`
- Use these branch names to link commits to Linear issues

---

## Maintenance & Tracking

### Source of Truth

- **Roadmap:** `context/foundation/roadmap.md` - High-level strategy and sequencing
- **Linear:** [plant-it workspace](https://linear.app/plant-it) - Day-to-day task tracking
- **PRD:** `context/foundation/prd.md` - Detailed requirements and specs

Keep `roadmap.md` and PRD as reference - do not delete after migration.

### Sync Strategy

When roadmap changes:
1. Update `roadmap.md` first
2. Create/update corresponding Linear issues
3. Document changes in this file

### Progress Tracking

**Weekly checkpoints:**
- Review project progress in Linear
- Update issue statuses and labels
- Identify and resolve blockers

**Completion criteria:**
- All acceptance criteria checkboxes marked
- Code reviewed and merged
- Tests passing
- Documentation updated

---

## Notes

- All issues were created on May 27, 2026
- Created by: Anna Kaźmierczak
- Linear automatically handles bidirectional blocking relationships
- Git branch names are auto-generated by Linear based on issue title
- Priority levels: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
- All issues start in "Backlog" status type "backlog"
- Linear MCP server documentation: [Linear MCP](https://github.com/linear/linear)
