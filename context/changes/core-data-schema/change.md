---
change_id: core-data-schema
title: Core database schema for plants, actions, photos, and user profiles
status: planned
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

**Roadmap ref:** F-01

Database schema foundation for the Plant It app:
- **plants** table: name, photo_url, user_id, grid_x, grid_y
- **actions** table: plant_id, action_type_id (nullable FK), custom_action_name (nullable TEXT), date, weather_data, additional_data
  - **Predefined action**: `action_type_id` points to `action_types` table (has icon, i18n-ready) - e.g., "watering", "fertilizing", "pruning"
  - **Custom action**: `action_type_id` IS NULL, user enters `custom_action_name` (e.g., "planting seedling during full moon")
  - `additional_data`: detailed notes/description (e.g., "planted seedling from Kate's garden, she said to plant during full moon")
  - UI can display predefined actions with icons, custom actions without
- **action_types** table: id, name, icon_name (~30 predefined actions like "watering", "fertilizing", "planted from seed", etc.)
- **photos** table: action_id, photo_url, order
- **user profile extension**: location (coordinates), garden_width, garden_height
- **RLS policies**: user sees only their own data
- **indexes**: foreign keys and user_id columns

This schema unlocks S-01 (extended registration), S-02 (first plant + first action), and all subsequent slices.

**Schema design is foundational** — getting it wrong means expensive migrations later. Spend extra time on schema review:
- Coordinate system: text like "A3" vs numeric x/y
- weather_data JSON structure
- Photo storage strategy (URL patterns, cleanup on deletion)
- **Action names architecture**: `action_types` table with nullable FK approach (recommended) - allows displaying predefined actions with icons vs custom actions differently
- Initial set of ~30 predefined actions with icon names (list to be defined during planning)
- Icon strategy for action_types (icon pack to use, naming convention)
