# `@plant-it/code-review-agent`

Standalone package: local, scripted code review powered by the Cursor SDK (`@cursor/sdk`).
v1 is for **manual** runs only — not wired into CI/CD yet.

## Requirements

- Node.js **≥ 22.13** (root `.nvmrc`: `22.14.0`)
- `CURSOR_API_KEY` — [Cursor Dashboard → API Keys](https://cursor.com/dashboard/api)
- One-time install of this package (root `npm ci` does **not** install it):

```bash
# from repo root
npm run review:install
```

## Setup

Set the API key (one of):

```bash
# shell (preferred)
export CURSOR_API_KEY="crsr_..."

# or in the repo root (gitignored) — only CURSOR_* / REVIEW_* keys are read:
# .env  or  .dev.vars
CURSOR_API_KEY=crsr_...
```

### Security (read this)

- The wrapper loads **only** `CURSOR_API_KEY`, `CURSOR_MODEL`, `REVIEW_BASE`, and `REVIEW_HEAD` from `.env` / `.dev.vars`. Other secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`) are **not** imported into `process.env`.
- The local agent still has workspace tool access (read/shell). Prompt “review only” + `local.autoReview` are **best-effort**, not a hard sandbox. Do not treat this as safe to run against untrusted diffs or in CI with production secrets until sandbox / diff-injection work lands.

## Usage

From repo root (agent cwd = **repo root**):

```bash
npm run review
# or an explicit range:
npm run review -- --base main --head HEAD
```

Optional:

```bash
export CURSOR_MODEL=composer-2.5   # default
export REVIEW_BASE=origin/main
export REVIEW_HEAD=HEAD
```

## Behavior

| Aspect | v1 |
| --- | --- |
| Runtime | **local** (`local.cwd` = monorepo root) |
| Invocation | `Agent.create` + `agent.send` + streaming (`await using` dispose) |
| Scope | `git diff base...head` (wrapper preflight; agent runs the diff) |
| Edits | prompt “review only” + `local.autoReview` (best-effort, not a hard deny-list) |
| Exit codes | `0` finished / empty diff · `1` startup/`CursorAgentError` · `2` run error/cancel |

SDK docs context: `context/sdk/` (cached snapshot — prefer [official TypeScript SDK docs](https://cursor.com/docs/sdk/typescript)).
