---
change_id: testing-critical-path-action-auth
title: Critical-path action + auth integration
status: implementing
created: 2026-06-18
updated: 2026-06-18
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path action + auth integration".
Risks covered: #1 (action saved but missing from card/list teaser), #3 (cross-user data access / RLS), #6 (invalid action input accepted server-side). Test types planned: integration.
Risk response intent:
- #1: After POST action, plant card and list teaser both show the new action for the owning user; challenge "201 means read path works"; avoid happy-path-only POST without DB read-back.
- #3: User A cannot read/mutate User B's plant, action, or photo when authenticated; challenge "login implies ownership"; avoid testing only unauthenticated 401.
- #6: Oversized name, bad dates, >5 photos rejected with 4xx; challenge client-only validation; avoid mirroring zod as oracle.
