# Photo Storage Setup Implementation Plan

## Overview

Set up Supabase Storage infrastructure for plant photos with private bucket, RLS policies, upload API, and validation. This is a foundational change (F-02) that enables all photo-related features in subsequent slices (S-02 onwards).

## Current State Analysis

**What exists:**
- Database schema with `photos` table (photo_url, order_index, action_id FK) and RLS policies via `actions` → `plants` → `user_id`
- Supabase SSR client (`src/lib/supabase.ts`) that provides `.storage` access
- API route pattern: POST handlers with `formData()` and redirect-based errors
- Storage enabled in `supabase/config.toml` with 50MiB global limit

**What's missing:**
- Supabase Storage bucket (no buckets defined)
- Storage RLS policies (no policies on `storage.objects` table)
- Upload API endpoint (`/api/photos/upload` doesn't exist)
- File handling utilities (multipart parsing, validation, storage helpers)
- Zod validation (documented in AGENTS.md but not yet used in codebase)

### Key Discoveries:

- Supabase Storage SDK is accessed via `supabase.storage` from existing SSR client — no additional dependencies needed (line 10, src/lib/supabase.ts)
- Storage RLS uses `storage.objects` table with policies per operation (SELECT/INSERT/DELETE), following same pattern as database RLS (lines 105-132, supabase/migrations/20260604120000_core_data_schema.sql)
- Storage bucket path structure choice (user_folders: `user_id/action_id/filename`) aligns with ownership model and simplifies RLS policy (`storage.foldername(name)[1]` check)
- Astro supports file uploads via `request.formData()` in API routes or newer Actions pattern; current codebase uses API routes exclusively (src/pages/api/auth/*)
- Private buckets require signed URLs or RLS-checked public URLs; user chose storing public URL from `getPublicUrl()` with RLS enforcement (no signed URL generation overhead)

## Desired End State

A specification of the desired end state after this plan is complete:

**Infrastructure:**
- Storage bucket `plant-photos` exists with `public: false`, MIME type restrictions (JPEG/PNG/WebP), 10MB per-file limit
- RLS policies on `storage.objects` enforce user ownership via path prefix (`{user_id}/...`)
- Migration is reproducible (SQL in `supabase/migrations/`)

**API:**
- `POST /api/photos/upload` accepts multipart form data with action_id + file
- Validates: auth (middleware), file type (JPEG/PNG/WebP), file size (≤10MB), max 5 photos per action (database count)
- Returns JSON: `{ success: true, photo: { id, photo_url, size_bytes } }` or structured error
- File stored at path: `{user_id}/{action_id}/{uuid}.{ext}`

**Helpers:**
- `src/lib/storage.ts` provides typed upload/download functions
- Error types and validation schemas in `src/types.ts`

**Verification:**
- Integration tests cover: valid upload, invalid file type, file too large, max 5 exceeded, unauthenticated rejected
- Manual test: upload photo via curl, verify RLS denies cross-user access, check database `photo_url` column populated

## What We're NOT Doing

- **Automatic storage cleanup when photos/actions/plants are deleted** — database CASCADE deletes rows, but storage blobs persist. Deferred to future change (orphaned file cleanup job or trigger).
- **Client-side direct upload (presigned URLs)** — simpler flow uploads through API; direct-to-storage deferred to future optimization.
- **Image transformation (resize, compress, thumbnail generation)** — store originals only; transformations deferred to S-02 implementation or later.
- **HEIC support** — iPhone default format requires server-side conversion; accept JPEG/PNG/WebP only for MVP simplicity. Users must export/convert HEIC on device.
- **Progress indication during upload** — API returns after upload completes; client-side progress bar deferred to UI implementation in S-02.
- **Retry logic for transient storage errors** — API returns error; client responsible for retry. Future enhancement.
- **CDN or edge caching** — Supabase Storage public URLs are Supabase-served; Cloudflare R2 or CDN deferred to post-MVP.
- **Concurrent upload race condition fix** — two simultaneous uploads could exceed max-5 limit; low priority for single-user MVP (future: database constraint or serializable transaction).

## Implementation Approach

**Three-phase approach:**

1. **Infrastructure (migration)** — Create storage bucket + RLS policies via SQL migration. This is foundational and blocks API implementation.
2. **API endpoint (upload)** — Build `/api/photos/upload` with validation (zod), file handling (multipart), storage SDK integration, and max-5 enforcement. Introduces first JSON API to codebase (breaking from redirect pattern).
3. **Helpers & types** — Extract reusable storage helpers (`src/lib/storage.ts`) and error types to DRY the API code and support future download/delete operations.

**Key design choices** (from user decisions):
- **Bucket structure**: `user_id/action_id/filename.ext` aligns with ownership model, simplifies RLS (`storage.foldername(name)[1] = auth.uid()::text`)
- **File validation**: JPEG/PNG/WebP, max 10MB (covers 95% of mobile camera use cases without HEIC complexity)
- **API response format**: JSON with photo metadata (enables multi-photo upload UX, breaks from redirect pattern)
- **Max-5 validation**: API layer (server-side enforcement via database count query before upload)
- **Error handling**: Structured JSON errors with codes (`QUOTA_EXCEEDED`, `INVALID_FILE_TYPE`, `MAX_PHOTOS_EXCEEDED`)
- **Storage RLS**: Private bucket with path-based policies (mirrors database RLS user ownership model)
- **URL generation**: Store full public URL from `getPublicUrl()` in `photos.photo_url` (RLS enforces access, no signed URL overhead)
- **Testing**: Integration tests for API validation logic (manual E2E deferred to S-02 UI implementation)

## Phase 1: Storage Infrastructure

### Overview

Create Supabase Storage bucket and RLS policies via SQL migration. Enable storage locally via `config.toml` update.

### Changes Required:

#### 1. Storage Migration

**File**: `supabase/migrations/20260604180000_photo_storage_setup.sql`

**Intent**: Create private storage bucket for plant photos with MIME type and size restrictions. Set up RLS policies on `storage.objects` to enforce user ownership via path prefix. Enable storage locally for development.

**Contract**: Migration creates `storage.buckets` row with `id = 'plant-photos'`, `public = false`, `file_size_limit = 10485760` (10MB), `allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']`. Four RLS policies on `storage.objects` (SELECT/INSERT/UPDATE/DELETE) check `bucket_id = 'plant-photos'` AND `(storage.foldername(name))[1] = auth.uid()::text`.

#### 2. Local Storage Configuration

**File**: `supabase/config.toml`

**Intent**: Mirror production bucket in local development environment for testing.

**Contract**: Uncomment and configure `[storage.buckets.plant-photos]` block with `public = false`, `file_size_limit = "10MiB"`, `allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]`. Matches migration settings.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up`
- Local storage starts: `npx supabase start` shows storage service healthy
- Bucket exists in local DB: `SELECT id, public FROM storage.buckets WHERE id = 'plant-photos'` returns 1 row with `public = false`
- RLS policies exist: `SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'plant_photos_%'` returns 4
- TypeScript types regenerate: `npx supabase gen types typescript --local > src/database.types.ts` completes without error

#### Manual Verification:

- Browse local Supabase dashboard (http://localhost:54323) → Storage section shows `plant-photos` bucket
- Click bucket → shows empty (no files yet)
- Bucket settings show: Private, 10MB limit, MIME types restricted
- RLS tab shows 4 policies (select/insert/update/delete) on storage.objects

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Upload API Endpoint

### Overview

Build `/api/photos/upload` endpoint that accepts multipart form data, validates file type/size, enforces max-5 limit, uploads to storage, and inserts database row.

### Changes Required:

#### 1. Install zod dependency

**File**: `package.json`

**Intent**: Add zod for runtime validation (currently documented but not installed). Required for file upload validation schema.

**Contract**: Add `"zod": "^3.24.1"` to `dependencies`. Run `npm install` to update lockfile.

#### 2. Storage helper functions

**File**: `src/lib/storage.ts`

**Intent**: Provide typed wrappers for Supabase Storage upload/download operations. DRY the storage SDK calls and centralize error handling.

**Contract**: Export `uploadPhoto(supabase, file, userId, actionId): Promise<{ photo_url: string, size_bytes: number }>` that generates UUID filename, constructs path `{userId}/{actionId}/{uuid}.{ext}`, calls `supabase.storage.from('plant-photos').upload(path, file)`, returns public URL from `getPublicUrl(path)`. Throws typed errors for storage failures.

**Note on getPublicUrl()**: Despite the method name, `getPublicUrl()` returns a path-based URL that still requires RLS-checked auth for private buckets. When a client (browser/API) requests the URL, Supabase checks the anon key JWT in request headers against `storage.objects` RLS policies. The URL is not "public" in the sense of being accessible without auth — RLS enforcement happens at request time. Alternative: `createSignedUrl()` for time-limited access, but adds latency (deferred per "What We're NOT Doing").

#### 3. Error types for API responses

**File**: `src/types.ts`

**Intent**: Define structured error response shape for JSON APIs. Enables type-safe error handling in client code.

**Contract**: Export `ApiError` interface with `code: string`, `message: string`, `details?: Record<string, unknown>`. Export error code constants: `ERROR_CODES = { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED', INVALID_FILE_TYPE: 'INVALID_FILE_TYPE', MAX_PHOTOS_EXCEEDED: 'MAX_PHOTOS_EXCEEDED', FILE_TOO_LARGE: 'FILE_TOO_LARGE', UNAUTHORIZED: 'UNAUTHORIZED', MISSING_ACTION_ID: 'MISSING_ACTION_ID' }`.

#### 4. Photo upload API route

**File**: `src/pages/api/photos/upload.ts`

**Intent**: Accept multipart form upload with action_id + file, validate all constraints (auth, file type, size, max-5), upload to storage, insert `photos` row, return JSON response. First JSON API in codebase (breaks redirect pattern).

**Contract**: Export `const prerender = false` and `export const POST: APIRoute = async (context) => { ... }`. Parse `formData()` with zod schema `{ action_id: z.string().uuid(), file: z.instanceof(File) }`. Validate file type (check `file.type` against `image/jpeg`, `image/png`, `image/webp`), size (check `file.size <= 10 * 1024 * 1024`), and max-5 (query `SELECT COUNT(*) FROM photos WHERE action_id = $1` < 5). Check action ownership via RLS (query `SELECT plant_id FROM actions WHERE id = $1` succeeds means user owns it). Call `uploadPhoto(supabase, file, context.locals.user.id, action_id)`, insert `photos` row with returned `photo_url`, return `Response.json({ success: true, photo: { id, photo_url, size_bytes } }, { status: 201 })`. On validation failure, return `Response.json({ error: { code, message, details } }, { status: 400/403/413 })`.

File type validation snippet (non-obvious MIME type check):

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
  return Response.json(
    {
      error: {
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        details: { received: file.type },
      },
    },
    { status: 400 }
  );
}
```

Max-5 validation (database count query before upload to prevent exceeding limit):

```typescript
const { count, error: countError } = await supabase
  .from('photos')
  .select('*', { count: 'exact', head: true })
  .eq('action_id', action_id);

if (countError) {
  throw new Error(`Failed to count photos: ${countError.message}`);
}

if (count !== null && count >= 5) {
  return Response.json(
    {
      error: {
        code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
        message: 'Maximum 5 photos per action',
        details: { current_count: count },
      },
    },
    { status: 400 }
  );
}
```

#### 5. Update middleware protected routes

**File**: `src/middleware.ts`

**Intent**: Protect photo upload API from unauthenticated access.

**Contract**: Add `/api/photos` to `PROTECTED_ROUTES` array (line 4). Middleware already redirects unauthenticated users to `/auth/signin`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build` succeeds
- Linting passes: `npm run lint` succeeds
- Integration tests pass (see Testing Strategy below): `npm run test:integration` succeeds
- API route responds to OPTIONS (CORS preflight if needed): `curl -X OPTIONS http://localhost:4321/api/photos/upload` returns 200 or 204

#### Manual Verification:

- Upload valid photo (authenticated): `curl -X POST -H "Cookie: ..." -F "action_id={uuid}" -F "file=@test.jpg" http://localhost:4321/api/photos/upload` returns 201 with JSON `{ success: true, photo: { ... } }`
- Upload invalid file type: `-F "file=@test.txt"` returns 400 with `INVALID_FILE_TYPE` error
- Upload file too large: `-F "file=@large.jpg"` (>10MB) returns 413 or 400 with `FILE_TOO_LARGE`
- Upload 6th photo to same action: returns 400 with `MAX_PHOTOS_EXCEEDED`
- Upload without auth: returns 302 redirect to `/auth/signin` (middleware)
- Check database: `SELECT photo_url FROM photos WHERE action_id = ...` shows uploaded photo URL
- Check storage: Supabase dashboard Storage → `plant-photos` bucket shows file at `{user_id}/{action_id}/{uuid}.ext`
- Verify RLS: attempt to read photo from different user's session returns access denied

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Integration Tests & Documentation

### Overview

Write integration tests for upload API validation logic. Update README and AGENTS.md with photo storage setup instructions.

### Changes Required:

#### 1. Install vitest

**File**: `package.json`

**Intent**: Add Vitest test framework for integration tests. Vitest is a fast, Vite-native test runner with Supabase client compatibility.

**Contract**: Add `"vitest": "^2.1.8"` to `devDependencies`. Optionally add `"@vitest/coverage-v8": "^2.1.8"` for coverage reports. Run `npm install --save-dev vitest` to update lockfile.

#### 2. Test utilities setup

**File**: `src/lib/test-utils.ts`

**Intent**: Provide test helpers for creating authenticated Supabase client and seeding test data.

**Contract**: Export `createTestClient(): SupabaseClient` that uses `SUPABASE_URL` and `SUPABASE_KEY` from test environment. Export `seedTestData(supabase): Promise<{ userId: string, actionId: string }>` that inserts test user + plant + action via service role, returns IDs for test assertions.

#### 3. Upload API integration tests

**File**: `src/pages/api/photos/upload.test.ts`

**Intent**: Test all validation paths in upload API: happy path, invalid file type, file too large, max 5 exceeded, unauthenticated, and Storage RLS isolation.

**Contract**: Vitest test suite with 7 test cases:
1. `POST /api/photos/upload` with valid file returns 201 + photo metadata
2. Invalid MIME type returns 400 + `INVALID_FILE_TYPE` error
3. File >10MB returns 400/413 + `FILE_TOO_LARGE` error
4. 6th photo upload returns 400 + `MAX_PHOTOS_EXCEEDED` error
5. Unauthenticated request returns 401 or redirect
6. Action not owned by user returns 403 (RLS blocks action query)
7. User B cannot access user A's photo via Storage (RLS blocks cross-user storage.from().download())

#### 4. Test configuration

**File**: `vitest.config.ts`

**Intent**: Configure Vitest for integration tests with Supabase local instance.

**Contract**: Export Vitest config with `test.environment = 'node'`, `test.include = ['src/**/*.test.ts']`, setup file that starts local Supabase and loads test env vars.

#### 5. Update README

**File**: `README.md`

**Intent**: Document photo storage setup for new developers.

**Contract**: Add section "Photo Storage" after "Database" section (around line 115). Explain: 1) Migration creates `plant-photos` bucket, 2) RLS policies enforce user ownership, 3) Upload API at `/api/photos/upload`, 4) Local testing: `npx supabase start` enables storage, 5) Production: migrations auto-apply via CI, verify bucket in Supabase dashboard.

#### 6. Update AGENTS.md

**File**: `AGENTS.md`

**Intent**: Add photo storage patterns to agent onboarding doc (Critical Rules or Architecture section).

**Contract**: Add bullet to Architecture section: "Photo storage: Supabase Storage bucket `plant-photos` (private, RLS via `storage.objects` policies), upload API at `/api/photos/upload` (multipart + zod), helpers in `src/lib/storage.ts`, max 5 photos per action enforced at API layer."

#### 7. Package.json test script

**File**: `package.json`

**Intent**: Add test script for running integration tests.

**Contract**: Add `"test:integration": "vitest run"` and `"test:watch": "vitest"` to `scripts` object.

### Success Criteria:

#### Automated Verification:

- Tests run: `npm run test:integration` executes all 7 tests
- All tests pass: exit code 0
- Test coverage >80% on upload API: `vitest --coverage` (if coverage configured)
- README renders correctly: preview in markdown viewer shows Photo Storage section

#### Manual Verification:

- New developer follows README instructions: can upload test photo after `npx supabase start`
- AGENTS.md photo storage entry is concise and accurate
- Test suite can be run in CI: add `npm run test:integration` to `.github/workflows/ci.yml` and verify green check (deferred to separate commit)

**Implementation Note**: After completing this phase and all automated verification passes, the photo storage setup is complete. S-02 (first plant + first action) can now consume `/api/photos/upload` via React forms.

---

## Testing Strategy

### Unit Tests:

- `src/lib/storage.ts`: Test `uploadPhoto()` with mocked Supabase client
  - Happy path: returns photo_url and size_bytes
  - Storage failure: throws typed error
  - Invalid path: throws error
- `src/types.ts`: No unit tests (type definitions only)

### Integration Tests:

- `src/pages/api/photos/upload.test.ts`: Test full API flow against local Supabase
  - Valid upload: 201 response, database row inserted, storage object exists
  - Invalid file type: 400 with `INVALID_FILE_TYPE` error
  - File too large: 400/413 with `FILE_TOO_LARGE` error
  - Max 5 photos: 400 with `MAX_PHOTOS_EXCEEDED` after 5th upload
  - Unauthenticated: 401 or redirect to `/auth/signin`
  - Cross-user database access: 403 (RLS blocks action ownership query)
  - Cross-user storage access: User B cannot download user A's photo via storage.from().download() (Storage RLS blocks)

### Manual Testing Steps:

1. Start local Supabase: `npx supabase start`
2. Run migrations: `npx supabase migration up`
3. Create test user via signup UI: `http://localhost:4321/auth/signup`
4. Create test plant + action via database insert (SQL Editor or `psql`)
5. Upload photo via curl with auth cookie: `curl -X POST -H "Cookie: sb-access-token=..." -F "action_id={uuid}" -F "file=@test.jpg" http://localhost:4321/api/photos/upload`
6. Verify response: 201 with `{ success: true, photo: { id, photo_url, size_bytes } }`
7. Check database: `SELECT * FROM photos WHERE action_id = '{uuid}'` shows row with photo_url
8. Check storage: Supabase dashboard → Storage → `plant-photos` → see file at `{user_id}/{action_id}/{uuid}.jpg`
9. Test RLS: create second user, attempt to upload photo to first user's action → expect 403 or empty action (RLS blocks)
10. Test file type validation: upload `.txt` file → expect 400 `INVALID_FILE_TYPE`
11. Test file size validation: upload >10MB image → expect 400/413 `FILE_TOO_LARGE`
12. Test max 5 limit: upload 5 photos to same action, attempt 6th → expect 400 `MAX_PHOTOS_EXCEEDED`
13. Test unauthenticated: upload without auth cookie → expect 401 or redirect

## Performance Considerations

**Storage quota monitoring:**
- Supabase free tier: 50 GB storage, 2 GB bandwidth/month
- Monitor storage usage in Supabase dashboard (Settings → Usage)
- 10MB per photo × 5 photos per action × estimated 100 actions in MVP = ~5 GB total (well under limit)
- Bandwidth: assumes ~20 photo uploads/day during testing = 200 MB/month (under limit)
- Risk: If quota exceeded, uploads fail with `QUOTA_EXCEEDED` error — user must upgrade or delete old photos

**API response time:**
- Upload flow: parse multipart (~10ms) → count photos query (~50ms) → storage upload (~500ms for 5MB) → insert photos row (~50ms) = ~600ms total
- Target: <2s for 10MB upload on typical broadband (5 Mbps upload = 2s theoretical)
- Bottleneck: Supabase Storage upload latency (network-bound)
- No optimization needed for MVP (single-file upload, no concurrency)

**RLS policy performance:**
- Storage RLS checks `storage.foldername(name)[1] = auth.uid()::text` on every operation
- Uses indexed `name` column on `storage.objects` (Supabase default index)
- Expected: <10ms policy evaluation (simple string prefix match)
- Database RLS on `photos` table uses FK indexes (`idx_photos_action_id`) — already optimized in F-01

**Deferred optimizations:**
- Client-side direct upload (presigned URLs) to offload bandwidth from API
- Image compression/resizing at upload time (reduce storage + bandwidth)
- CDN caching for photo URLs (Cloudflare R2 or Supabase CDN)
- Lazy loading / thumbnail generation for plant list view

## Migration Notes

**No data migration needed** — this is a greenfield setup (no existing photos in database or storage).

**Rolling back:**
- Migration down: `DROP TABLE` statements in `supabase/migrations/20260604180000_photo_storage_setup.sql` down-migration (optional, not required by Supabase CLI)
- Manual rollback: delete bucket via Supabase dashboard or SQL `DELETE FROM storage.buckets WHERE id = 'plant-photos'`
- Storage blobs: deleting bucket also deletes all files (irreversible — backup first if needed)

**Production deployment:**
- Migrations auto-apply via GitHub Actions CD pipeline (already configured in `.github/workflows/ci.yml`)
- After deploy, verify bucket exists in hosted Supabase dashboard (Storage section)
- Test upload via production API: `curl -X POST https://plant-it.anna-kazmierczak-it.workers.dev/api/photos/upload ...`
- Monitor Cloudflare Workers CPU time: upload API adds ~100-200ms (may approach 10ms free-tier limit)

**Environment secrets:**
- No new secrets required (`SUPABASE_URL` and `SUPABASE_KEY` already configured)
- Local: `.env` or `.dev.vars` (existing)
- CI: GitHub secrets `SUPABASE_URL`, `SUPABASE_KEY` (existing)
- Production: `npx wrangler secret put` (existing)

## References

- Related migration: `supabase/migrations/20260604120000_core_data_schema.sql` (photos table, database RLS)
- Roadmap: `context/foundation/roadmap.md` F-02 (photo storage scope)
- PRD: `context/foundation/prd.md` FR-007 (max 5 photos), NFR (photos private)
- Supabase Storage docs: https://supabase.com/docs/guides/storage
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
- Astro file upload docs: https://docs.astro.build/en/guides/actions/ (Actions pattern, not used in this plan)
- Existing Supabase client: `src/lib/supabase.ts:6-25` (SSR client factory)
- Database RLS pattern: `supabase/migrations/20260604120000_core_data_schema.sql:105-132` (photos policies)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage Infrastructure

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase migration up`
- [x] 1.2 Local storage starts: `npx supabase start` shows storage service healthy
- [x] 1.3 Bucket exists in local DB: query returns 1 row with `public = false`
- [x] 1.4 RLS policies exist: query returns 4 policies
- [x] 1.5 TypeScript types regenerate: `npx supabase gen types` completes

#### Manual

- [ ] 1.6 Browse local dashboard → Storage section shows `plant-photos` bucket with correct settings

### Phase 2: Upload API Endpoint

#### Automated

- [ ] 2.1 TypeScript compiles: `npm run build` succeeds
- [ ] 2.2 Linting passes: `npm run lint` succeeds
- [ ] 2.3 Integration tests pass: `npm run test:integration` succeeds
- [ ] 2.4 API route responds to OPTIONS: returns 200 or 204

#### Manual

- [ ] 2.5 Upload valid photo (authenticated) returns 201 with JSON photo metadata
- [ ] 2.6 Upload invalid file type returns 400 with `INVALID_FILE_TYPE` error
- [ ] 2.7 Upload file too large returns 400/413 with `FILE_TOO_LARGE`
- [ ] 2.8 Upload 6th photo to same action returns 400 with `MAX_PHOTOS_EXCEEDED`
- [ ] 2.9 Upload without auth returns 302 redirect to `/auth/signin`
- [ ] 2.10 Database photo_url column populated after upload
- [ ] 2.11 Storage dashboard shows file at correct path
- [ ] 2.12 Verify RLS: different user cannot access photo

### Phase 3: Integration Tests & Documentation

#### Automated

- [ ] 3.1 Tests run: `npm run test:integration` executes all 7 tests
- [ ] 3.2 All tests pass: exit code 0
- [ ] 3.3 Test coverage >80% on upload API
- [ ] 3.4 README renders correctly: Photo Storage section visible

#### Manual

- [ ] 3.5 New developer can follow README to upload test photo
- [ ] 3.6 AGENTS.md photo storage entry is accurate and concise
