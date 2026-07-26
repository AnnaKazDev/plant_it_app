# `@plant-it/code-review-agent`

Standalone package: local, scripted code review powered by the Cursor SDK (`@cursor/sdk`).
v1 is for manual runs; CI/CD comes in a later lesson.

## Requirements

- Node.js **≥ 22.13** (root `.nvmrc`: `22.14.0`)
- `CURSOR_API_KEY` — [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)

## Setup

```bash
cd packages/code-review-agent
npm install
```

Set the API key (one of):

```bash
# shell
export CURSOR_API_KEY="crsr_..."

# or in the repo root (gitignored) — the script loads both files:
# .env  or  .dev.vars
CURSOR_API_KEY=crsr_...
```

## Usage

From the package directory (agent cwd = **repo root**, not the package):

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

SDK docs context: `context/sdk/`.
