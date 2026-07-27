## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself so that main workflow is easy to reason about

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best.

### 1. Stack Conventions (Astro + React + Cloudflare)
- **API routes:** Must export `const prerender = false` (SSR mode)
- **API handlers:** Use uppercase `GET`, `POST` exports (Astro convention)
- **Component choice:** Astro for static content, React ONLY when interactivity is needed
- **No Next.js directives:** Never use `"use client"` or `"use server"` (this is Astro, not Next.js)
- **Path alias:** Use `@/*` for `src/*` imports consistently
- **Hooks location:** React hooks must be in `src/components/hooks/`
- **Shared types:** Common types (entities, DTOs) go in `src/types.ts`

### 2. Tailwind Class Handling
- **CRITICAL:** Use `cn()` helper from `@/lib/utils` for conditional/merged class names
- **NEVER** concatenate Tailwind class strings manually (e.g., `className="foo " + bar`)
- **Rationale:** Manual concatenation bypasses tailwind-merge, causing duplicate utility classes

### 3. Supabase Patterns
- **Migrations format:** `YYYYMMDDHHmmss_short_description.sql` in `supabase/migrations/`
- **RLS enforcement:** Every new table MUST have RLS enabled with granular per-operation, per-role policies
- **Photo storage:** Max 5 photos per action, JPEG/PNG/WebP only, ≤10MB (enforced at API layer)
- **Type generation:** After migration, run `npm run lint:fix -- src/database.types.ts` (see `context/foundation/lessons.md`)
- **Index strategy:** Avoid duplicate indexes on same column; verify each index serves distinct query pattern

### 4. Cloudflare Workers Constraints
- **CPU limit:** Free tier = 10ms per request, current baseline = 18-20ms
- **Impact:** Flag any expensive synchronous operations (heavy loops, large string operations, complex regex)
- **Async preference:** Use async/await for I/O; avoid blocking operations
- **Rationale:** Exceeding 10ms requires upgrade to Workers Paid ($5/month)

### 5. Security & Validation
- **Input validation:** API routes must use zod schemas (all user inputs)
- **Auth checks:** Protected endpoints verify user session via middleware
- **Secrets:** No hardcoded credentials; use `astro:env/server` for server-only secrets
- **RLS enforcement:** Database operations respect Row Level Security policies
- **Sensitive data:** No PII, tokens, or keys in logs or client responses

### 6. Code Quality & TypeScript
- **TypeScript strict:** No `any`, proper types (args/vars starting with `_` allowed for unused)
- **React JSX transform:** Use `jsx: "react-jsx"` (no React imports needed in React files)
- **Naming:** Clear, descriptive names following project patterns
- **DRY & SOLID:** Extract common logic, single responsibility principle
- **Complexity:** Functions should be understandable; refactor when cognitive load is high

### 7. Testing
- **Coverage:** Non-trivial logic has Vitest integration tests in `src/**/*.test.ts`
- **Edge cases:** Test error paths, null/undefined, boundary conditions
- **Test utilities:** Use `src/lib/test-utils.ts` helpers (seedTestData, createTestFile, cleanupTestData)
- **Rationale:** Integration tests run against local Supabase; unit tests for pure logic

### 8. Performance & Optimization
- **Database queries:** Optimized queries, proper indexes, avoid N+1
- **React islands:** Minimize client-side JavaScript bundle (use Astro when possible)
- **Large payloads:** Stream or paginate when possible
- **Redundant operations:** Avoid unnecessary re-renders, repeated computations

### 9. Logic & Error Handling
- **Edge cases:** Null/undefined checks, empty arrays, boundary values
- **Error paths:** Proper try/catch with user-friendly error messages
- **Regressions:** Change doesn't break existing functionality
- **Unhandled cases:** All code paths return appropriate values

### 10. Lessons Learned Compliance
- **Historical patterns:** Check `context/foundation/lessons.md` for known anti-patterns
- **Repeated mistakes:** Flag changes that reintroduce previously fixed issues
- **Index planning:** Favor useful indexes over duplicates (see lessons.md)
- **Supabase types:** Verify lint:fix is mentioned in migration plans

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added

