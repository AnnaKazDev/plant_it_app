# Repository Guidelines

An Astro 6 SSR web application with React 19 islands, Tailwind 4, Supabase authentication, and Cloudflare Workers deployment.

## Critical Rules

- **Git workflow**: NEVER commit or push without explicit approval. Always ask before running `git commit` or `git push`. The user controls when changes enter the repository.
- **API routes**: Must export `const prerender = false` (SSR mode, see @astro.config.mjs).
- **Tailwind classes**: Use `cn()` helper from `@/lib/utils` for conditional/merged class names. Never concatenate class strings manually.
- **No Next.js directives**: Do not use `"use client"` or `"use server"`. This is Astro with React islands, not Next.js.
- **Supabase migrations**: Place in `supabase/migrations/` with format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation policies.

## Project Structure

- `src/pages/` — Astro pages (file-based routing)
- `src/pages/api/` — API endpoints (must use uppercase `GET`, `POST` exports)
- `src/components/` — UI components (Astro for static, React for interactive)
- `src/components/ui/` — shadcn/ui components ("new-york" style variant)
- `src/layouts/` — Astro layouts
- `src/lib/` — Services, helpers, utilities
- `src/middleware.ts` — Auth middleware (runs on every request)

Path alias: `@/*` maps to `./src/*` (see @tsconfig.json).

## Commands

See @package.json scripts section.

Pre-commit: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Coding Style

- **TypeScript**: strict mode, React JSX transform (`jsx: "react-jsx"`), no unused vars (args/vars starting with `_` allowed).
- **Components**: Prefer Astro components for static content; use React only when interactivity is needed. Extract hooks to `src/components/hooks/`.
- **Types**: Shared types (entities, DTOs) go in `src/types.ts`.
- **ESLint**: flat config with strict type-checked rules, React Compiler, Astro plugin, accessibility rules (see @eslint.config.js).

## Testing

No test framework configured yet. Tests should follow the pattern `*.test.ts` or `*.spec.ts` when added.

## Pull Requests & CI

See @.github/workflows/ci.yml for the full pipeline. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets.

All steps must pass before merge.

## Environment & Secrets

- Node.js v22.14.0 (see @.nvmrc)
- Secrets: `SUPABASE_URL`, `SUPABASE_KEY` (declared in @astro.config.mjs `env.schema` as server-only)
- Local dev: copy @.env.example to `.env` (for Node) or `.dev.vars` (for Cloudflare)
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx wrangler deploy` (set secrets in Cloudflare dashboard or via `npx wrangler secret put`)

See @README.md and @CLAUDE.md for deeper architectural details.
