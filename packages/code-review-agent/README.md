# `@plant-it/code-review-agent`

Standalone package: local, scripted code review powered by the Cursor SDK (`@cursor/sdk`).
Runs automatically on PRs via GitHub Actions (`.github/workflows/review.yml`), and can be invoked manually.

## ⚠️ Security Limitations — READ BEFORE FIRST USE

**Current security posture — understand before enabling in CI:**

### Data transmission
- **The precomputed diff and review prompt are sent to Cursor's API.** Do not run against branches that may contain secrets in the diff (e.g., committed `.env` files, API keys in code).
- GitHub Actions workflow runs in a clean checkout without `.env` / `.dev.vars` files, but the diff content itself is transmitted.

### Local execution risks
When running locally (not in CI):
- **Secret exposure risk:** The wrapper loads only `CURSOR_API_KEY`, `CURSOR_MODEL`, `REVIEW_BASE`, and `REVIEW_HEAD` from `.env` / `.dev.vars` (app secrets like `SUPABASE_SERVICE_ROLE_KEY` are NOT imported into `process.env`). However, the local agent still has **full workspace read/shell access** and can read gitignored files (`.env`, `.dev.vars`) directly from disk.
  
- **Write protection:** Prompt instructs "review only" and `local.autoReview: true` gates **some** write operations, but these are **best-effort, not a sandbox**. The agent can potentially modify files if misclassified.
  
- **Post-run check:** v1 now snapshots `git status --porcelain` before/after and exits with code `3` if the working tree changed. This catches accidental modifications but does not prevent them.

### CI/CD usage (GitHub Actions)
- Safe for trusted contributors only (diff content is sent to Cursor API)
- Requires `CURSOR_API_KEY` secret in repository settings
- Runs in a clean environment without production secrets on disk
- Cannot modify the repository (workflow runs with read-only checkout)

**Do NOT:**
- Run against untrusted/malicious diffs or untrusted contributor PRs without review
- Include secrets in commit messages or code comments within the diff range
- Rely on this as a security boundary

**Future hardening:** diff-injection (no shell git), sandboxing via `local.sandboxOptions.enabled: true`, `preToolUse` hooks to deny write tools, or running in a clean checkout without secret files.

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
# shell (preferred — highest precedence)
export CURSOR_API_KEY="crsr_..."

# or in the repo root (gitignored) — only CURSOR_* / REVIEW_* keys are read:
# .env  or  .dev.vars
CURSOR_API_KEY=crsr_...
```

**Precedence:** shell environment > `.env` > `.dev.vars` (first source wins for each key)

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
| Scope | `git diff base...head` (committed changes only; **excludes** uncommitted/staged changes) |
| Edits | prompt “review only” + `local.autoReview` (best-effort, not a hard deny-list) |
| Exit codes | `0` finished / empty diff · `1` startup/`CursorAgentError` · `2` run error/cancel · `3` working tree modified |

**Configuration notes:**

- **Settings isolation:** `settingSources: []` isolates the run from ambient Cursor IDE and project configuration, making behavior predictable in CI/scripts. However, this prevents using repo-level `.cursor/permissions.json` to further restrict tool access. For now, `autoReview` default backend behavior provides the gate.
- **Uncommitted changes:** The triple-dot diff (`base...head`) compares commits only. Use `git add` + `git commit` before running the review if you want to include working-tree changes.
- **Diff size limits:** Diffs are capped at 500 KB in the prompt (truncated with warning if larger). Hard limit: diffs exceeding 10 MiB will cause the process to fail. For large refactors, consider reviewing in smaller chunks.
- **Output formatting:** Terminal output includes:
  - **Colors:** Severity markers (🔴 red for blocker, 🟡 yellow for major, 🟢 green for minor, ⚪ gray for nit)
  - **Clickable links:** File paths are hyperlinked (OSC 8) — click to open in VS Code (works in VS Code terminal, iTerm2, Windows Terminal)
  - **Structured sections:** Headers, issues, and code snippets are visually separated

## Review criteria

The agent evaluates code against five dimensions:

1. **Logic and bugs** — errors, regressions, unhandled edge cases
2. **Security** — input validation, secrets, auth, RLS policies
3. **Performance** — N+1 queries, unnecessary loops, optimization opportunities
4. **Code quality** — SOLID/DRY, naming, TypeScript strictness, conventions
5. **Testing** — coverage of non-trivial behavior and edge cases

## Troubleshooting

Common issues and solutions when running the code review agent.

### Exit code 1: "Missing CURSOR_API_KEY"

Ensure the environment variable is set:

```bash
# Check if key is present
echo $CURSOR_API_KEY

# If missing, add to .env or .dev.vars:
CURSOR_API_KEY=your_key_here
```

### Exit code 3: Working tree modified

The agent made unexpected file changes. Check `git status` output in logs. This usually indicates:

- Agent misclassified review as implementation task
- Prompt needs refinement to clarify "review only" intent
- Bug in `autoReview` gating

### 403 Forbidden in GitHub Actions

The workflow needs `pull-requests: write` permission. Verify `.github/workflows/ai-review.yml` includes:

```yaml
permissions:
  contents: read
  pull-requests: write
```

### Review output is empty or truncated

- **Empty diff:** Ensure commits exist in `REVIEW_BASE...REVIEW_HEAD` range
- **Truncated:** Diff exceeds 500 KB; review smaller commit ranges or file subsets

## Resources

- [Cursor TypeScript SDK docs](https://cursor.com/docs/sdk/typescript) — official documentation
- `context/sdk/cookbook-quickstart.ts` — minimal working example
