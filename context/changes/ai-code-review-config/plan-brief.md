# AI Code Review Configuration Enhancement — Plan Brief

> Full plan: `context/changes/ai-code-review-config/plan.md`
> Research: `context/changes/ai-code-review-config/research.md`

## What & Why

Enhance the existing working code-review workflow with four improvements: composite action structure for maintainability, 10-criteria scoring system (1-10 scale) for quantitative metrics, automatic PR labels for quick triage, and on-demand retry capability via label trigger. The goal is to preserve all current functionality (colors, issue statistics, PR comment format) while adding structured scoring and automation to support quality tracking and faster review cycles.

## Starting Point

The project has a solid Cursor SDK-based code review agent (`packages/code-review-agent/`) that works well today. It precomputes git diffs, streams formatted output with ANSI colors, enforces read-only execution via working tree guards, and loads lessons.md for historical anti-patterns. The GitHub Actions workflow triggers on PRs to main, runs the review, and posts a comment with issue counts and severity markers (BLOCKER/MAJOR/MINOR/NIT). There are no labels, no scoring, and no retry mechanism - triage and quality tracking are manual.

## Desired End State

PR authors see an automatic review comment within 1-2 minutes showing overall score (e.g., "8.2/10 — ✅ PASS"), issue statistics preserved from today's format, and detailed findings in a collapsible section. PRs are automatically labeled `ai-cr:passed` (green, score ≥7.0) or `ai-cr:failed` (red, score <7.0) for quick triage. Authors can retry review without pushing commits by adding the `ai-cr:review` label, which auto-removes after processing. The workflow is cleaner - review execution is isolated in a composite action, making testing and future extensions easier. Quantitative scores enable tracking quality trends over time.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| **Composite action vs reusable workflow** | Composite action | Step-level reuse, lighter weight, same runner context, better for this use case | Research |
| **Scoring algorithm** | Deduction model (start at 10, subtract per severity) | Simple, transparent, aligns with existing BLOCKER/MAJOR/MINOR/NIT markers | Research |
| **Pass threshold** | Hardcoded 7.0/10 | Industry standard "Good" tier, keep v1 simple, add configurability in v2 if needed | Plan |
| **Output format** | Dual-mode: scoring table at top + existing detailed findings below | Preserves current format (colors, issue stats, file:line references), adds quantitative metrics | Research |
| **Label creation method** | Manual in repo settings | Simpler than API workflow, one-time 2-minute task | Plan |
| **Implementation order** | Sequential (7 phases) | Minimize risk with clear dependencies, enable easy rollback at each step | Plan |
| **Label cleanup on retry** | Remove `ai-cr:review` after processing | Prevents duplicate runs, clear signal that retry completed | Plan |
| **Testing depth** | Thorough (3-5 draft PRs) | Balance speed and confidence before production use | Plan |
| **Rollback strategy** | Keep backup workflow for 1 week | Quick revert if issues arise, delete after monitoring confirms stability | Plan |

## Scope

**In scope:**
- Composite action refactoring (extract review execution to `.github/actions/ai-review/action.yml`)
- 10-criteria scoring system (1-10 scale, deduction algorithm per criterion)
- Scoring table output (markdown table with scores, grades, issue summaries)
- Automatic PR labels (`ai-cr:passed`, `ai-cr:failed`)
- Atomic label replacement (remove old ai-cr:* before adding new)
- Retry trigger via `ai-cr:review` label
- Label cleanup after retry
- PR comment format enhancement (add score to status, preserve issue statistics)
- Documentation updates (README, AGENTS.md)
- Thorough testing (3-5 draft PRs covering clean/issues/retry/edge cases)

**Out of scope:**
- Weighted criteria (simple average in v1, can add in v2)
- Per-criterion minimum thresholds (e.g., Security must be ≥8.0)
- Configurable pass threshold (hardcoded 7.0 in v1)
- Score history tracking across PRs (future enhancement)
- Branch protection integration (review is advisory, doesn't block merging)
- Auto-fix suggestions
- Changes to formatter colors or local CLI output
- Changes to exit code semantics (0/1/2/3)
- Changes to working tree guard or git helpers

## Architecture / Approach

**Composite action pattern**: Extract review execution (install deps, run review, strip ANSI) from main workflow into `.github/actions/ai-review/action.yml` with explicit inputs (api-key, model, base-ref, head-ref) and outputs (exit-code, review-output path). Main workflow delegates to action, then parses output for scoring and labeling.

**Scoring integration**: Update `packages/code-review-agent/src/prompt.ts` to add scoring methodology section (deduction algorithm) and new output format specification (scoring table before Summary/Findings sections). Agent calculates scores per criterion, outputs markdown table at top of review. Workflow parses overall score via regex, determines pass/fail (≥7.0), applies appropriate label.

**Label lifecycle**: On PR open/update, workflow adds `ai-cr:passed` or `ai-cr:failed` based on score. Atomic replacement: list current labels, remove all `ai-cr:*`, add new. On `ai-cr:review` label addition, workflow triggers, runs review, updates label, removes retry label. Conditional prevents normal PR events from removing retry label.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Label Creation | 3 PR labels in repo (passed/failed/review) | None - manual setup, 2 min |
| 2. Composite Action | Review logic isolated in `.github/actions/ai-review/` | Workflow syntax error, secrets not passed correctly |
| 3. Scoring System | 10-criteria scoring output in review | Prompt changes break output parsing, markdown table malformed |
| 4. Label Management | Automatic labels based on score | Score parsing fails, atomic replacement has race condition |
| 5. Retry Trigger | On-demand retry via label | Trigger condition wrong, label not cleaned up |
| 6. Integration Testing | 3-5 draft PRs validate all scenarios | Edge cases missed, regressions introduced |
| 7. Documentation | README + AGENTS.md updated, backup deleted | None - documentation only |

**Prerequisites:** 
- Existing working code-review agent in `packages/code-review-agent/`
- GitHub Actions workflow in `.github/workflows/ai-review.yml`
- `CURSOR_API_KEY` secret configured in repo
- Ability to create draft PRs for testing

**Estimated effort:** ~3-4 hours across 7 phases (label setup: 2 min, composite action: 30-45 min, scoring: 45-60 min, labels: 30 min, retry: 15 min, testing: 60-90 min, docs: 30 min)

## Open Risks & Assumptions

**Risks:**
- Score parsing regex may fail if agent output format deviates unexpectedly (mitigation: thorough testing in Phase 3, fallback to issue-count-based status)
- Atomic label replacement could have race condition if two workflows run concurrently (mitigation: test in Phase 6, GitHub API handles conflicts gracefully)
- Large diffs (>500KB) are truncated - scoring may be inaccurate for very large PRs (existing limitation, not introduced by this change)
- LLM model changes could alter scoring behavior over time (mitigation: hardcode model version `composer-2.5`, monitor first 5 PRs)

**Assumptions:**
- 7.0 pass threshold is appropriate for this project (can adjust later if too strict or lenient)
- Simple average across 10 criteria is sufficient (no weighting needed in v1)
- Agent will reliably output scoring table in correct format (based on prompt instructions)
- Existing issue severity markers (BLOCKER/MAJOR/MINOR/NIT) map cleanly to point deductions
- Manual label creation is acceptable (no automation needed for one-time setup)

## Success Criteria (Summary)

**From user perspective:**
- PRs get automatic review comment within 1-2 min with overall score and issue statistics
- PR labels correctly reflect pass/fail state (green for ≥7.0, red for <7.0)
- Adding `ai-cr:review` label triggers re-run and label auto-removes after completion
- Comment format preserves colors, emoji, issue counts from current implementation
- Detailed review includes scoring table (10 criteria) followed by existing findings format

**From maintainer perspective:**
- Workflow is easier to reason about (composite action isolates review logic)
- Testing is easier (can modify action independently, test locally with `npm run review`)
- Future extensions are simpler (clear input/output interface)
- Rollback is trivial (restore `.github/workflows/ai-review.yml.bak`)
