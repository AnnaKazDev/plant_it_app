<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Photo Storage Setup

- **Plan**: context/changes/photo-storage-setup/plan.md
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: SOUND (after fixes)
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | PASS |

## Grounding

7/7 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Storage RLS not verified in automated tests

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Integration Tests
- **Detail**: Plan listed 6 integration test cases (Phase 3, item 2) but test case #6 verified database RLS ("Action not owned by user returns 403"), not Storage RLS. The critical security boundary — user A cannot access user B's photos via Storage — was tested only manually (Phase 2.12). This is the most important test for the PRD privacy requirement (NFR: "Photos must be private").
- **Fix A ⭐ Recommended**: Add 7th test case for cross-user Storage access
  - Strength: Catches storage RLS misconfiguration before production; matches the pattern in existing photos table RLS (F-01 tested database policies via integration tests).
  - Tradeoff: Adds ~15 min to test writing; requires seeding two users and testing storage.from() access with different auth.
  - Confidence: HIGH — Storage RLS is complex (path-based policy); manual testing alone risks missing edge cases.
  - Blind spot: None significant — this is a standard integration test.
- **Fix B**: Accept manual-only RLS testing, add explicit reminder
  - Strength: No code changes; faster to implement; manual test is already defined (Phase 2.12).
  - Tradeoff: No regression protection; if Storage RLS policy is later edited, nothing catches breakage until production.
  - Confidence: MEDIUM — manual testing is sufficient if team is disciplined about running it, but photo privacy is a hard requirement.
  - Blind spot: Assumes manual test is thorough enough (current test: "attempt to read photo from different user's session").
- **Decision**: FIXED via Fix A

### F2 — getPublicUrl + private bucket pattern unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Upload API, Key Design Choices
- **Detail**: Plan said "Store full public URL from getPublicUrl() in photos.photo_url (RLS enforces access, no signed URL overhead)" and "Private bucket with path-based policies". This was conceptually unclear: how does RLS enforce access to a URL with "public" in its name? The codebase had no existing Storage usage to verify this pattern works. Supabase docs clarify: getPublicUrl() returns a URL that works with private buckets IF the request includes auth (via the anon key JWT in headers), and RLS checks run on each storage.from().download() or <img> load. But the plan didn't explain this, and the URL pattern could mislead implementers into thinking the bucket is public.
- **Fix**: Clarify in Phase 2.2 (storage helper) that getPublicUrl() returns a path-based URL that still requires RLS-checked auth, not a truly public URL. Add note: "Despite the method name, RLS still applies — the anon key in request headers is checked against storage.objects policies. Alternative: createSignedUrl() for time-limited access, but adds latency (deferred per 'What We're NOT Doing')."
  - Strength: Prevents implementer confusion; documents the Supabase Storage access model for future readers.
  - Tradeoff: Minor wording addition (~3 sentences); no code impact.
  - Confidence: HIGH — This is how Supabase Storage RLS works per official docs (verified during research phase).
  - Blind spot: If Supabase changes getPublicUrl behavior in a future SDK release, this could break (low risk — stable API).
- **Decision**: FIXED

### F3 — Vitest dependency not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — Integration Tests & Documentation
- **Detail**: Phase 3 item 3 created `vitest.config.ts` and item 6 added test scripts to package.json, but nowhere did the plan say "install vitest". The implementer would hit an error when running `npm run test:integration` because vitest wasn't in dependencies.
- **Fix**: Add Phase 3 item 0 (before test utilities): "Install vitest: Add `vitest` and `@vitest/coverage-v8` (optional, for coverage) to devDependencies. Run `npm install --save-dev vitest`."
- **Decision**: FIXED
