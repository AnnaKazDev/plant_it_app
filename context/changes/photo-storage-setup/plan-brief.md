# Photo Storage Setup — Plan Brief

> Full plan: `context/changes/photo-storage-setup/plan.md`

## What & Why

Set up Supabase Storage infrastructure for plant photos: private bucket with RLS policies, upload API endpoint with validation, and storage helpers. This is a foundational change (F-02 from roadmap) that enables all photo-related features — plant avatars, action photos, and the visual growth timeline that is the core product value.

## Starting Point

Database schema exists with `photos` table (photo_url, order_index, action_id FK) and RLS policies that enforce user ownership via the `actions` → `plants` → `user_id` chain. Supabase SSR client provides `.storage` access. API routes follow a pattern of POST handlers with `formData()` and redirect-based errors. No storage bucket, no upload API, no file handling utilities exist yet.

## Desired End State

Developers (and later, React forms in S-02) can POST multipart form data to `/api/photos/upload` with action_id + file, and the API validates auth, file type (JPEG/PNG/WebP), size (≤10MB), and max-5-per-action constraint, uploads the file to a private Supabase Storage bucket at path `{user_id}/{action_id}/{uuid}.ext`, inserts a `photos` row with the returned public URL, and returns JSON `{ success: true, photo: { id, photo_url, size_bytes } }`. RLS on `storage.objects` prevents cross-user access. Integration tests cover all validation paths.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Bucket path structure | `user_id/action_id/filename.ext` | Aligns with user ownership model and simplifies RLS policy (single `storage.foldername(name)[1] = auth.uid()::text` check). | Plan |
| File type validation | JPEG/PNG/WebP, max 10MB | Covers 95% of mobile camera use cases without HEIC server-side conversion complexity. | Plan |
| API response format | JSON with photo metadata | Enables multi-photo upload UX and client-side progress; breaks from redirect pattern intentionally. | Plan |
| Max-5 enforcement | API layer (database count query) | Server-side enforcement prevents client bypass; single source of truth. | Plan |
| Error handling | Structured JSON with error codes | Client can handle each error type differently (quota exceeded → show upgrade, invalid file → format hint). | Plan |
| Storage RLS | Private bucket, path-based policies | Mirrors database RLS ownership model; prevents URL-guessing attacks (PRD privacy requirement). | Plan |
| URL pattern | Store public URL from getPublicUrl | RLS enforces access; no signed URL generation overhead; compatible with private bucket + RLS. | Plan |
| Testing approach | Integration tests (API + Storage) | Catches validation regressions; validates RLS; documents expected behavior; ~20% time overhead acceptable for foundation. | Plan |

## Scope

**In scope:**
- Storage bucket creation via SQL migration (`plant-photos`, private, 10MB limit, MIME type restrictions)
- RLS policies on `storage.objects` (SELECT/INSERT/UPDATE/DELETE, user ownership via path prefix)
- Upload API endpoint `/api/photos/upload` (multipart, zod validation, max-5 check, JSON response)
- Storage helpers `src/lib/storage.ts` (uploadPhoto wrapper, error handling)
- Error types and validation schemas in `src/types.ts`
- Integration tests for all validation paths (6 test cases)
- README + AGENTS.md updates with photo storage setup instructions

**Out of scope:**
- Automatic storage cleanup when photos/actions deleted (database CASCADE deletes rows, blobs persist — deferred to cleanup job)
- Client-side direct upload with presigned URLs (simpler flow through API — future optimization)
- Image transformation (resize, compress, thumbnails — store originals only, defer to S-02 or later)
- HEIC support (iPhone format requires server conversion — accept JPEG/PNG/WebP only for MVP)
- Progress indication during upload (API returns after completion — defer to UI)
- Retry logic for transient storage errors (client responsible — future enhancement)
- Concurrent upload race condition fix (two simultaneous uploads could exceed max-5 — low priority for single-user MVP)

## Architecture / Approach

**Three-phase approach:**

1. **Infrastructure (migration)**: SQL migration creates `storage.buckets` row + 4 RLS policies on `storage.objects`. Local `config.toml` mirrors bucket settings. Reproducible via git-tracked migration file.
2. **API endpoint**: `/api/photos/upload` (POST) accepts multipart form, validates with zod (first usage in codebase), checks file type/size/max-5, calls `supabase.storage.from('plant-photos').upload()`, inserts `photos` row, returns JSON (first JSON API, breaks redirect pattern). Introduces zod as runtime dependency.
3. **Helpers & tests**: Extract `src/lib/storage.ts` for reusable upload logic, define error types in `src/types.ts`, write integration tests with Vitest (new test setup), update README + AGENTS.md.

**Key integrations:** Supabase Storage SDK (via existing SSR client), database `photos` table (existing schema), middleware auth (existing `context.locals.user`), RLS policies (same pattern as database RLS in F-01).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Storage Infrastructure | Storage bucket + RLS policies via migration; local config mirroring | Migration failure or RLS misconfiguration could block all uploads |
| 2. Upload API Endpoint | `/api/photos/upload` with validation, storage integration, JSON response, max-5 enforcement | Multipart parsing or storage SDK integration issues; first JSON API pattern |
| 3. Integration Tests & Documentation | Vitest test suite (6 cases), README + AGENTS.md updates | Test environment setup complexity (local Supabase requirement) |

**Prerequisites:** Database schema from F-01 (core-data-schema) must be applied. Supabase local instance running (`npx supabase start`). Node v22.14.0 (per `.nvmrc`).

**Estimated effort:** ~2-3 sessions across 3 phases. Phase 1 (migration) is smallest (~30min), Phase 2 (API) is largest (~2-3 hours), Phase 3 (tests) is medium (~1 hour). Manual testing adds ~30min per phase.

## Open Risks & Assumptions

- **Assumption:** Supabase free tier (50 GB storage, 2 GB bandwidth/month) suffices for MVP testing. Reality check: 10MB × 5 photos × 100 actions = ~5 GB storage, well under limit. Monitor usage in dashboard.
- **Risk:** Cloudflare Workers CPU time (10ms free-tier limit) may be approached with upload API (~100-200ms added). Monitor with `npx wrangler tail` after deployment; may require upgrade to Workers Paid ($5/month).
- **Risk:** Concurrent upload race condition (two simultaneous uploads could exceed max-5 limit) low priority for single-user MVP but worth noting. Fix: database constraint or serializable transaction (deferred).
- **Assumption:** JPEG/PNG/WebP covers 95% of use cases. iPhone HEIC exclusion acceptable — users export/convert on device. If user friction high in testing, add server-side HEIC conversion in follow-up.
- **Risk:** RLS policy error could expose photos cross-user. Mitigation: manual RLS test in Phase 1.6 (create two users, verify isolation). Critical security boundary.

## Success Criteria (Summary)

- Upload valid photo (authenticated, JPEG/PNG/WebP, ≤10MB) returns 201 JSON with photo metadata + database row inserted + storage object exists at `{user_id}/{action_id}/{uuid}.ext`
- Upload invalid file type / too large / 6th photo / unauthenticated returns appropriate error code (400/413/401) with structured JSON
- RLS isolates photos: user A cannot access user B's photos (verified via manual test with two users)
- Integration tests pass (all 6 cases) and can run in CI (`npm run test:integration`)
- New developer can follow README to upload test photo after `npx supabase start` and `npx supabase migration up`
