---
project: "Plant It"
context_type: greenfield
created: 2026-05-23
updated: 2026-05-23
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "data trapped — photos and actions exist but scattered across phone camera roll, memory, paper notes"
    - topic: "insight"
      decision: "existing garden apps focus on care schedules but miss the visual growth story — photos over time"
    - topic: "primary persona scope"
      decision: "single user — building for own garden first"
    - topic: "auth model"
      decision: "login (email + password); flat user model"
    - topic: "mvp timeline"
      decision: "3 weeks of after-hours work"
    - topic: "product type"
      decision: "web app (browser on desktop or mobile)"
    - topic: "target scale"
      decision: "medium (dozens to 100 users); at 100x scale would need bigger database and photo storage"
    - topic: "timing"
      decision: "hard deadline: 2026-07-01; after-hours work"
  frs_drafted: 16
  quality_check_status: accepted
---

# Plant It — Shape Notes

## Vision & Problem Statement

Hobby gardeners planting multiple plants across different growth stages, locations in the garden, and time periods lose track of when plants were planted, how they looked at each stage, and what care activities have already been performed. The cost is real: watering gets forgotten, fertilizing happens twice, and there's no way to see whether a plant is thriving or struggling because the visual timeline is trapped in the phone's camera roll and care actions live only in memory.

Existing garden apps focus on care schedules and plant databases but miss the growth story. The insight: a gardener wants to *see* the plant's journey — photo history showing how it changed over time — tied to the actions that shaped that growth (watering, fertilizing, pruning). The story is the product, not just the schedule.

## User & Persona

**Primary persona:** Anna, hobby gardener

Anna plants vegetables, herbs, and flowers in her home garden. She starts plants from seeds and seedlings, moves them between pots and ground beds, and tracks growth across months. She gardens after work and on weekends — it's a hobby, not a profession. The moment she reaches for this product: standing in the garden, phone in hand, looking at a tomato plant and unable to remember when she last watered it, whether she already fertilized this week, or how tall it was when she transplanted it a month ago. She pulls out her phone to record the current state and check what she's already done.

## Access Control

Email login (password-based). Flat user model — every logged-in user has full access to their own garden data. No roles, no sharing, no admin layer in MVP. Sign-up requires location (city or coordinates) to pull weather and moon phase data for the user's garden. It also requires to set up garden dimensions (width x height in meters).

## Success Criteria

### Primary

Anna can complete the full tracking flow that proves the product works:
1. Register and provide location (city/coordinates) and garden dimensions (width x height in meters)
2. Log in
3. Add first plant - "Calendula" - with photo + name + garden location (place on map grid)
4. Add action: "planted in ground" with specific date, add photo/photos for that stage. Action can be chosen from predefined such as "from seedling", "seeds", "watering" etc or typed manually (max 300 signs). Additional text can be also added.
5. See plant card showing action teaser with first image from this action, action name (as text or as tag), info about weather from action day - sun/rain, temperature, moon phase etc
6. Add second action for "Calendula" plant: "watering" scheduled 3 days ahead. No user photo added, so system shows placeholder icon.
7. See plant card showing teasers from previously added actions. 
8. Return to plant list view.
9. Add second plant: "Sunflower" with img, name, and place it on garden map in different location.
10. Add action for "Sunflower": "planted from seed", today (chosen from calendar), added 3 photos of the plant.
11. See plant list (2 plants, each showing last action teaser). Teaser shows: photo, action, date of action, weather from the day of action. Planned actions show visual indicator (badge/count).
12. Open garden map view
13. See both plants positioned on map grid (Calendula and Sunflower in different locations)
14. Click on plant icon on map → opens plant card
15. Later, add third plant "Sunflower" in different garden location, track which location produces better growth.

Success metric: Anna adds more than 10 plants and more than 5 actions per plant within one year.

### Secondary

- Moon phase data displayed alongside weather data in calendar and action teasers

### Guardrails

- Photos must be private — only the owner sees their plant photos
- Application must be fast — list loads quickly, actions save without delay
- User can add multiple photos (max 5) to a single action (not limited to one photo per action)
- User can see garden map with position of the plants

## Functional Requirements

### Authentication & Access
- FR-001: User can register and provide garden location (city/coordinates) and garden dimensions (width x height in meters). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-002: User can log in. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-003: User can see only their own plants. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Plant Management
- FR-004: User can add a plant with name, optional photo and location in a garden (as a grid). System automatically generates display name using plant name + map coordinates (e.g., "Sunflower (A3)"). If no photo provided, system uses default plant icon. Priority: must-have
  > Socrates: Counter-argument considered: "Photo could be optional." Resolution: made photo optional; system provides default icon from app assets if user doesn't upload one. Added: system auto-generates identifier from map coordinates so multiple plants with same name are distinguishable.

- FR-005: User can see a list of all added plants with teasers showing the last action. Plant display name includes coordinates (e.g., "Sunflower (B7)"). If plant has no actions yet, teaser shows only photo and plant name with coordinates. Priority: must-have
  > Socrates: Counter-argument considered: "What if a plant has no actions yet?" Resolution: empty-state handled — teaser shows photo and name with coordinates only.

- FR-006: User can see a plant card view where all actions and images for that plant are collected. Priority: must-have
  > Socrates: Counter-argument considered: "Plant card duplicates the plant list." Resolution: kept; plant list shows summary (10 plants), plant card shows full history (8+ actions per plant).

### Action Tracking
- FR-007: User can add an action to a plant with photos (max 5), action name (from predefined list or typed manually max 300 characters), and date (selected from calendar). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-008: User can choose any date for an action — past, today, or future (as planned action). Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-009: User can see in every action teaser: photo of a plant, action name, date, weather info (temperature, rain, sun). Priority: must-have
  > Socrates: Counter-argument considered: "Moon phase is secondary — drop it from teasers for MVP." Resolution: removed moon phase from action teasers; kept in calendar only (FR-013).

- FR-010: User can see planned actions indicated with a badge/count in the plant list. Priority: must-have
  > Socrates: Counter-argument considered: "A simple badge/count is enough for MVP." Resolution: simplified to badge instead of elaborate visual representation.

- FR-011: System shows a placeholder icon for an action if user doesn't provide a photo. Priority: must-have
  > Socrates: Counter-argument considered: "A placeholder icon would be clearer than a default photo." Resolution: changed to placeholder icon instead of default photo.

### Garden Map
- FR-012: User can provide garden dimensions (width x height in meters) during registration. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-013: User can place a plant at specific coordinates on garden map when adding it. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-014: User can see a garden map view showing all plants positioned at their garden locations. Each plant should have different location on a map.Priority: must-have
  > Socrates: No counter-argument; it stands as written.

- FR-015: User can click on a plant icon on the map to open that plant's card. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

### Search & Filter
- FR-016: User can search by name of plant, action type, etc. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written.

## User Stories

### US-01: User adds first plant and tracks first action

- **Given** a logged-in user with garden location and garden dimension set
- **When** they add a plant with photo and name and garden location (grid), then add an action "planted in ground" with date and photo and location on garden map grid
- **Then** they see the plant card with action teaser showing photo, action name, date, and weather info

#### Acceptance Criteria
- Plant appears in plant list immediately after creation
- Action teaser includes: first photo from action, action name/tag, date, weather data (temperature, rain/sun) from that date
- Weather data is fetched from API based on user's location and action date
- If action has no photos, placeholder icon is shown
- User can add multiple photos (max 5) to a single action

## Business Logic

"Plant It" app tracks gardening activities with photos, dates, and locations, combining them with weather data to show how plants grow and what care they need next.

**Input:** Anna provides photo(s) of a plant, action name (predefined or typed), date from calendar, and places the plant on her garden map grid. She also provides her city/location during registration.

**Output:** The application fetches weather data (temperature, rain, sun) for that date and location, and displays it alongside the action in the plant's timeline. Garden map shows all plants spatially.

**Encounter:** Anna sees this in three places: (1) plant card history showing actions with weather context, (2) plant list teasers showing last action with weather, (3) garden map showing spatial distribution of plants.

## Non-Functional Requirements

- Anna sees acknowledgement of any input (button click, form submit) within 500ms. Loading plant list, plant card, or garden map completes within 2 seconds under normal network conditions.
- The application remains usable on the latest two major versions of Chrome, Safari, and Firefox on both desktop and mobile browsers.
- Photos and action history are retained as long as Anna's account exists. User-initiated deletion of individual plants or actions is supported; full account deletion is out of MVP scope.
- Weather data for historical actions is stored with the action at creation time (no repeated API calls). Weather API is called only when creating a new action. If weather API is unavailable during action creation, the application shows a clear error message and allows the user to retry or save the action without weather data.
- Photos are private — only the account owner can view their plant photos. No sharing, no public galleries in MVP.

## Non-Goals

- **Push notifications for planned actions** — No reminder system in MVP. Users must check the app to see planned actions (visible as badges in plant list). Rationale: notification infrastructure adds complexity; for 3-week MVP with after-hours work, manual checking is sufficient.

- **Sharing gardens between users** — Strictly single-user in MVP. No multi-user access, no shared gardens, no collaboration features. Rationale: keeps auth model simple (flat, no permissions) and reduces scope.

- **Advanced map features** — MVP uses simple rectangular grid (width x height in meters). Non-rectangular garden shapes, custom boundaries, drag-and-drop plant positioning, sunlight zone mapping, and freeform drawing are out of scope. Rationale: rectangular grid is fastest to implement and covers majority of home gardens; advanced shapes are post-MVP enhancement.

- **Full account deletion** — Users can delete individual plants or actions, but full account deletion with data purge is out of MVP scope. Rationale: data retention policy and GDPR-compliant deletion add legal/technical complexity beyond 3-week timeline.


