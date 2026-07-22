<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Critical-path action + auth integration — Phase 4

- **Plan**: context/changes/testing-critical-path-action-auth/plan.md
- **Scope**: Phase 4 of 5 (Two-user ownership boundaries)
- **Date**: 2026-07-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Unguarded afterAll cleanup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/ownership.test.ts:54-57
- **Detail**: `afterAll` calls `cleanupTestData(userA.userId)` and `cleanupTestData(userB.userId)` without optional chaining. Every sibling integration test guards with `if (testData?.userId)`. If `beforeAll` fails before assignment, cleanup may run with `undefined` and leave seeded users behind.
- **Fix**: Guard cleanup: `if (userA?.userId) await cleanupTestData(userA.userId)` (same for B).
- **Decision**: FIXED

### F2 — Mutate-rejection tests lack DB oracles

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/ownership.test.ts:88-148
- **Detail**: POST action, PATCH/DELETE action, and photo upload cross-user tests assert only HTTP 404 + error code. They do not verify via admin client that no row was created, updated, or deleted. A handler bug returning 404 while still mutating would pass. Plan Phase 4 explicitly allows "admin verification/counts"; Risk #6 tests in `validation.test.ts` use `countActionsForPlant` / `getRowCounts` as the stronger pattern. DELETE plant test does include positive read-back (A GET → 200); PATCH/DELETE action tests do not confirm A's action is unchanged.
- **Fix A ⭐ Recommended**: Add admin read-back after each mutate rejection — e.g. `getRowCounts(admin, { plantId, actionId })` before/after, or GET plant card as User A and assert action unchanged.
  - Strength: Matches Risk #6 oracle pattern and plan guidance; catches silent mutations behind 404.
  - Tradeoff: ~15–25 lines; slightly slower tests.
  - Confidence: HIGH — `getRowCounts` already exists in test-utils from Phase 3.
  - Blind spot: None significant.
- **Fix B**: Accept HTTP-only oracles for ownership (404 is sufficient contract test)
  - Strength: Keeps tests minimal; matrix already passes.
  - Tradeoff: Weaker Risk #3 signal vs plan's own "admin verification" allowance.
  - Confidence: MEDIUM — production RLS + handler checks make silent mutation unlikely.
  - Blind spot: Handler returning wrong status while DB mutates would not be caught.
- **Decision**: FIXED (Fix A)

### F3 — Photo URL cross-user access not tested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: N/A
- **Detail**: Test-plan Risk #3 mentions photo URL access; Phase 4 matrix covers upload rejection only. No dedicated photo GET/storage URL isolation test. Acceptable for Phase 4 plan scope — no photo GET API exists today.
- **Fix**: Defer to Rollout Phase 2 (photo boundary tests) or add when a photo read endpoint ships.
- **Decision**: FIXED
