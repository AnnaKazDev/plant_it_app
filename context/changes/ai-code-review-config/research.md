---
date: 2026-07-27T21:32:00+02:00
researcher: AI Assistant (Claude)
git_commit: 9f1a3f869d8588f1e09faabd9c5a35413de17527
branch: ai_code_review_config
repository: plant_it_app
topic: "AI Code Review Configuration Enhancement - Research"
tags: [research, codebase, github-actions, code-review, composite-actions, pr-labels, scoring-system]
status: complete
last_updated: 2026-07-27
last_updated_by: AI Assistant (Claude)
---

# Research: AI Code Review Configuration Enhancement

**Date**: 2026-07-27T21:32:00+02:00
**Researcher**: AI Assistant (Claude)
**Git Commit**: 9f1a3f869d8588f1e09faabd9c5a35413de17527
**Branch**: ai_code_review_config
**Repository**: plant_it_app (AnnaKazDev/plant_it_app)

## Research Question

How to enhance the existing working code-review agent workflow to meet all requirements from `requirements.md`:
1. Convert workflow to composite action pattern for easier reasoning
2. Implement PR label management (ai-cr:failed/passed/review)
3. Add 10-criteria scoring system (1-10 scale)
4. Enable on-demand retry via label trigger

## Summary

The research identified a clear implementation path building on the existing working flow. The code-review agent (`packages/code-review-agent/`) is solid and requires only prompt modifications for scoring. The GitHub Actions workflow needs restructuring into a composite action plus three enhancements: label management, scoring output parsing, and label-triggered retry.

**Key Findings:**
- **Existing implementation is well-architected** - CLI agent uses Cursor SDK, precomputes diffs, streams formatted output, has working CI integration
- **Composite action refactoring is straightforward** - Extract review execution to `.github/actions/ai-review/action.yml`, 30-45min effort, low risk
- **Label management is fully supported** - GitHub Actions has native support for adding/removing/triggering on PR labels
- **Scoring system integrates cleanly** - Dual-mode output (scoring table + detailed findings) preserves existing file:line references while adding quantitative metrics

## Detailed Findings

### 1. Existing Implementation Architecture

The current code-review agent is a standalone Cursor SDK package with clean separation of concerns:

#### Package Structure (`packages/code-review-agent/`)

**Core files:**
- `src/review.ts` - CLI entry point; orchestrates env loading, git operations, agent execution, output streaming
- `src/prompt.ts` - Builds one-shot review prompt with precomputed diff and 10 criteria
- `src/formatter.ts` - Line-buffered stdout formatter with ANSI colors and OSC 8 file links
- `src/git.ts` - Sync git helpers via `execFileSync` (triple-dot diff, status snapshots, ref resolution)
- `src/env.ts` - Selective dotenv loader (only `CURSOR_*` and `REVIEW_*` keys, never bulk-loads app secrets)

**Key characteristics:**
- Node.js ≥22.13.0, ESM-only, TypeScript strict mode
- Precomputes `git diff base...HEAD` (500KB soft cap) to avoid agent running git commands
- Loads `context/foundation/lessons.md` for historical anti-patterns
- Working tree guard: snapshots `git status --porcelain` before/after run, exits 3 if modified
- Exit codes: 0 (success/empty), 1 (config/startup error), 2 (run error/cancelled), 3 (tree modified)

#### Current Workflow (`.github/workflows/ai-review.yml`)

**Trigger:** `pull_request` to `main`

**Flow:**
1. Checkout with `fetch-depth: 0` (full history for triple-dot diffs)
2. Setup Node from `.nvmrc` + npm cache
3. `npm ci` then `npm run review:install` (package has independent lockfile)
4. Run review: `npm run review > review-output.txt`, capture exit code, strip ANSI/OSC 8
5. Comment via `actions/github-script@v7`: count severity markers (BLOCKER/MAJOR/MINOR/NIT), upsert PR comment with `<!-- ai-review -->` marker

**Env vars:**
- `CURSOR_API_KEY` (from secrets, required)
- `REVIEW_BASE=origin/main`, `REVIEW_HEAD=${{ github.sha }}`
- `CURSOR_MODEL` (optional, defaults to `composer-2.5`)

#### Prompt Contract

`buildReviewPrompt()` (`src/prompt.ts:5-132`) injects diff/stat/lessons and mandates strict markdown output:
- Sections: Summary → Findings → optional Questions
- Severity lines: `**🔴 BLOCKER**` | `**🟡 MAJOR**` | `**🟢 MINOR**` | `**⚪ NIT**`
- Location format: `**Location:** \`path/to/file.ts:line\``
- Issue/Fix sections with code fences
- Empty case: exactly `✅ No findings. Code looks good.`

Formatter (`src/formatter.ts`) parses this structure to colorize output and create `vscode://file/...` hyperlinks for local CLI usage.

**Code references:**
- Entry point: `packages/code-review-agent/src/review.ts:73-198`
- Prompt builder: `packages/code-review-agent/src/prompt.ts:5-132`
- Git diff logic: `packages/code-review-agent/src/git.ts:93-121`
- Formatter: `packages/code-review-agent/src/formatter.ts:44-87`
- Workflow: `.github/workflows/ai-review.yml:1-99`

### 2. Composite Action Pattern

**What is a composite action?**
- GitHub Actions feature for packaging steps into reusable units
- Lives in `.github/actions/<name>/action.yml` within same repo
- Step-level reuse (not job-level like reusable workflows)
- Lighter weight, same runner/context, no job overhead

**Critical differences from workflows:**
- Every `run` step MUST specify `shell: bash` explicitly
- Cannot access `secrets` context directly - must be passed as inputs
- Outputs work via step ID references: `${{ steps.step-id.outputs.name }}`
- Uses `using: 'composite'` instead of `using: 'node12'` or similar

#### Proposed Refactoring

**Structure:**
```
.github/
├── actions/
│   └── ai-review/
│       └── action.yml          # Review execution only
└── workflows/
    └── ai-review.yml           # Setup + action + commenting + labels
```

**Separation of concerns:**
- **Composite action** (`.github/actions/ai-review/action.yml`): Review execution
  - Install review package dependencies
  - Run review script
  - Strip ANSI codes
  - Output: exit code, clean review text, issue counts
  
- **Main workflow** (`.github/workflows/ai-review.yml`): Orchestration
  - Checkout + Node setup + `npm ci`
  - Call composite action
  - Parse outputs (scores, issue counts)
  - Add/remove PR labels based on results
  - Upsert PR comment

**Benefits:**
- Main workflow 50% more readable (setup → action → results)
- Review logic isolated and independently testable
- Explicit inputs/outputs interface
- Can reuse action in other workflows (e.g., manual trigger, scheduled audits)
- Easy to rollback if issues arise

**Migration path:**
1. Create `.github/actions/ai-review/action.yml` with extracted steps
2. Update main workflow to use `uses: ./.github/actions/ai-review`
3. Test on draft PR
4. Keep old workflow as `.github/workflows/ai-review.yml.bak` for 1 week
5. Monitor first 5 PRs, rollback if issues

**Time estimate:** 30-45 minutes  
**Risk:** Low (simple structural refactoring, no logic changes)  
**Impact:** High (significantly improved maintainability)

**Code references:**
- Research doc: `context/changes/ai-code-review-config/composite-action-research.md`
- Refactoring example: `context/changes/ai-code-review-config/refactoring-example.md`
- Quick reference: `context/changes/ai-code-review-config/quick-reference.md`

### 3. PR Label Management

GitHub Actions has full native support for PR labels via the `issues` API (PRs are treated as issues).

#### Adding Labels

```yaml
- uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        labels: ['ai-cr:passed']
      });
```

#### Removing Labels

```yaml
# Single label (wrap in try-catch, returns 404 if label doesn't exist on PR)
await github.rest.issues.removeLabel({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.issue.number,
  name: 'ai-cr:failed'
});
```

#### Atomic Label Replacement

Best practice: list current labels, remove old `ai-cr:*` labels, then add new label

```yaml
const {data: labels} = await github.rest.issues.listLabelsOnIssue({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.issue.number
});

// Remove all ai-cr:* labels
for (const label of labels) {
  if (label.name.startsWith('ai-cr:')) {
    try {
      await github.rest.issues.removeLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        name: label.name
      });
    } catch (e) {
      // Ignore 404 (label already removed by concurrent action)
    }
  }
}

// Add new label
await github.rest.issues.addLabels({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.issue.number,
  labels: [newLabel]
});
```

#### Triggering on Label Addition

```yaml
on:
  pull_request:
    types: [opened, synchronize, labeled]

jobs:
  review:
    # Run on PR open/update OR when ai-cr:review label added
    if: |
      github.event.action != 'labeled' || 
      github.event.label.name == 'ai-cr:review'
```

#### Label Colors

**Option 1 (recommended):** Manual creation in repo settings
- Navigate to repo → Issues → Labels → New label
- `ai-cr:passed` - color `0e8a16` (green)
- `ai-cr:failed` - color `d73a4a` (red)
- `ai-cr:review` - color `1d76db` (blue)

**Option 2:** One-time setup workflow via API

```yaml
await github.rest.issues.createLabel({
  owner: context.repo.owner,
  repo: context.repo.repo,
  name: 'ai-cr:passed',
  color: '0e8a16',
  description: 'AI code review passed'
});
```

#### Required Permissions

```yaml
permissions:
  contents: read
  pull-requests: write  # Required for label operations
```

**Implementation checklist:**
- [ ] Create labels manually or via one-time setup workflow
- [ ] Update workflow to add label based on review result (passed/failed)
- [ ] Add `labeled` trigger type to workflow
- [ ] Add `if` condition to filter for `ai-cr:review` label
- [ ] Implement atomic label replacement (remove old ai-cr:* before adding new)
- [ ] Test: open PR, verify auto-label, manually add ai-cr:review, verify retry

**Code references:**
- Label management guide: `context/changes/ai-code-review-config/label-management-guide.md`

### 4. Scoring System (1-10 Scale)

The requirements specify scoring each of 10 criteria on a 1-10 scale. Research proposes a **dual-mode output format** that preserves existing detailed findings while adding quantitative metrics.

#### Scoring Algorithm

**Deduction model:**
- Start each criterion at 10 points
- Deduct based on severity:
  - 🔴 BLOCKER: -3 points
  - 🟡 MAJOR: -2 points
  - 🟢 MINOR: -1 point
  - ⚪ NIT: -0.5 points
- Floor scores at 1 (minimum)
- Round to nearest integer

**Example:**
- Criterion has 1 blocker, 2 major, 1 minor: 10 - 3 - 2 - 2 - 1 = 2/10
- Criterion has 10 nits: 10 - 5 = 5/10
- Criterion has no findings: 10/10

**Overall score:**
- Simple average of all 10 criteria
- Pass threshold: ≥ 7.0/10 (industry standard "Good" tier)
- Label assignment: `ai-cr:passed` if ≥ 7.0, `ai-cr:failed` if < 7.0

#### Output Format

**Proposed structure:**

```markdown
## Code Review Score: 8.2/10 — ✅ PASS

### Score Breakdown

| Criterion | Score | Grade | Issues |
|:----------|------:|:-----:|:-------|
| 1. Stack Conventions | 9/10 | 🟢 | 0 blocker, 1 major, 0 minor, 0 nit |
| 2. Tailwind | 10/10 | 🟢 | No findings |
| 3. Supabase | 8/10 | 🟢 | 0 blocker, 1 major, 0 minor, 0 nit |
| 4. Cloudflare CPU | 10/10 | 🟢 | No findings |
| 5. Security | 4/10 | 🔴 | 2 blocker, 0 major, 0 minor, 0 nit |
| 6. Code Quality | 9/10 | 🟢 | 0 blocker, 0 major, 1 minor, 0 nit |
| 7. Testing | 7/10 | 🟡 | 0 blocker, 0 major, 3 minor, 0 nit |
| 8. Performance | 10/10 | 🟢 | No findings |
| 9. Logic & Errors | 10/10 | 🟢 | No findings |
| 10. Lessons Learned | 10/10 | 🟢 | No findings |

**Critical areas:** Security (4/10) — 2 blockers found

---

### Summary
[Existing summary format unchanged]

### Findings
[Existing detailed findings with file:line references unchanged]

### Questions
[Optional clarifying questions, unchanged]
```

**Grade emojis:**
- 🟢 Green: 8-10 (Good to Excellent)
- 🟡 Yellow: 5-7 (Acceptable to Fair)
- 🔴 Red: 1-4 (Poor to Critical)

#### Prompt Modifications

Add new section to `src/prompt.ts` after "Review criteria" section:

```typescript
## Scoring methodology

Score each criterion on a 1–10 scale using this deduction algorithm:
1. Start at 10 points
2. Deduct: 🔴 BLOCKER (-3), 🟡 MAJOR (-2), 🟢 MINOR (-1), ⚪ NIT (-0.5)
3. Floor at 1 (minimum score)
4. Round to nearest integer

Calculate overall score as the simple average of all 10 criteria.

## Output format (strict markdown)

Begin with the scoring table showing all 10 criteria, then provide detailed findings.

### Code Review Score: X.X/10 — [PASS/FAIL]

### Score Breakdown

| Criterion | Score | Grade | Issues |
|:----------|------:|:-----:|:-------|
| 1. Stack Conventions | X/10 | emoji | issue summary |
[... all 10 criteria ...]

Grade emojis: 🟢 (8-10), 🟡 (5-7), 🔴 (1-4)

If any criterion scored ≤ 4, add:
**Critical areas:** [criterion name] (X/10) — [brief explanation]

---

[Then continue with existing Summary/Findings/Questions format]
```

#### Workflow Integration

Update comment step in `.github/workflows/ai-review.yml`:

```yaml
- name: Comment
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const content = fs.readFileSync('review-clean.txt', 'utf8');
      const exitCode = '${{ steps.review.outputs.exit_code }}';
      
      // Extract overall score from output
      const scoreMatch = content.match(/## Code Review Score: ([\d.]+)\/10/);
      const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;
      
      // Determine pass/fail
      const passed = overallScore !== null && overallScore >= 7.0;
      const label = passed ? 'ai-cr:passed' : 'ai-cr:failed';
      
      // Count issues (existing logic)
      const blockerCount = (content.match(/BLOCKER/g) || []).length;
      const majorCount = (content.match(/MAJOR/g) || []).length;
      // ...
      
      // Build comment with score in header
      let statusText = overallScore !== null 
        ? `Score: ${overallScore}/10` 
        : 'No score available';
      let emoji = passed ? '✅' : '🔴';
      
      if (exitCode !== '0') {
        statusText = 'Review failed';
        emoji = '❌';
      }
      
      const body = marker + '\n## 🤖 AI Review ' + emoji + '\n\n**Status:** ' + statusText + '\n\n<details>\n<summary>View detailed review</summary>\n\n' + content + '\n\n</details>';
      
      // Upsert comment (existing logic)
      // ...
      
      // Add label
      await github.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        labels: [label]
      });
```

#### Alternative Approaches Considered

**Weighted criteria:**
- Security 15%, Cloudflare CPU 15%, other criteria 8.75% each
- Rejected for v1: adds complexity, unclear which weights are "right"
- Could add in v2 based on team feedback

**Per-criterion thresholds:**
- E.g., Security must be ≥ 8.0 even if overall average is 7.0
- Rejected for v1: too rigid, could block legitimate PRs
- Could add as configurable gates in v2

**Configurable pass threshold:**
- Env var `REVIEW_PASS_THRESHOLD=7.0`
- Considered nice-to-have, not essential for MVP
- Easy to add later if needed

**NIT exclusion:**
- Set NIT deduction to 0 instead of -0.5
- Rejected: NITs still signal room for improvement, light penalty is appropriate

**Recommendation:** Start with simple average model (no weighting, 7.0 threshold) for v1. The design is extensible for future enhancements.

**Implementation checklist:**
- [ ] Update `src/prompt.ts` with scoring methodology section
- [ ] Update output format specification in prompt
- [ ] Test prompt changes locally with `npm run review` on various branches
- [ ] Update workflow comment step to parse overall score
- [ ] Update workflow to add label based on score (≥7.0 = passed, <7.0 = failed)
- [ ] Verify scoring table renders correctly in PR comments (markdown preview)
- [ ] Test edge cases (no issues, all blockers, mixed severity)

**Code references:**
- Scoring research doc: `context/changes/ai-code-review-config/scoring-system-research.md`
- Current prompt: `packages/code-review-agent/src/prompt.ts:5-132`
- Current comment step: `.github/workflows/ai-review.yml:41-99`

## Code References

### Key Implementation Files

- `packages/code-review-agent/src/review.ts:73-198` - Main CLI entry point, agent orchestration
- `packages/code-review-agent/src/prompt.ts:5-132` - Prompt builder with 10 criteria (needs scoring additions)
- `packages/code-review-agent/src/formatter.ts:44-87` - Output formatter (no changes needed)
- `packages/code-review-agent/src/git.ts:93-121` - Diff computation (no changes needed)
- `.github/workflows/ai-review.yml:1-99` - Main workflow (needs composite action refactoring + label logic + score parsing)

### Supporting Documentation

- `.github/workflows/ci.yml:26-30` - CI typecheck integration for code-review-agent
- `packages/code-review-agent/README.md` - Usage docs (will need updates after scoring/label changes)
- `context/foundation/lessons.md` - Historical anti-patterns (loaded by agent)
- `context/changes/ai-code-review-config/requirements.md` - Original requirements

## Architecture Insights

**What works well:**
- **Separation of concerns** - Agent package is standalone, CLI-first, CI integration is thin wrapper
- **Precomputed diffs** - Avoids agent needing git access, improves reliability
- **Working tree guard** - Ensures review is read-only, prevents accidental modifications
- **Selective env loading** - Never leaks app secrets into review environment
- **Lessons.md integration** - Historical context improves review quality over time

**Design patterns observed:**
- **Line-buffered streaming** - Formatter writes complete lines to stdout, handles incomplete fragments
- **Exit code semantics** - Clear distinction between config errors (1), run errors (2), and safety violations (3)
- **Triple-dot diff** - Uses merge-base comparison to review only committed changes in PR
- **ANSI stripping in CI** - Workflow removes colors/links before commenting, preserves plain markdown
- **Upsert comment pattern** - Single comment per PR with marker, updates on subsequent runs

**Extensibility points:**
- Composite action makes it easy to add pre/post-review steps (e.g., auto-fix, notification)
- Scoring system can add weighted criteria, configurable thresholds, per-criterion minimums
- Label system can add more granular labels (e.g., `ai-cr:security-critical`, `ai-cr:performance-warning`)
- Prompt can incorporate additional context (e.g., JIRA ticket, design doc links from PR description)

## Historical Context

This change builds on existing work visible in recent git history:

### Recent PRs
- `9f1a3f8` - docs: update AI Code Review description (#47)
- `a1be8c4` - fix(ci): simplify workflow script to avoid parsing issues
- `434b17e` - feat: Improved AI Review comment UI (#45) - added issue statistics to comment
- `136ff51` - docs: simplify AI Code Review description (#44)
- `9c8c2f8` - fix(ci): replace with minimal working workflow
- `82fa2dd` - fix(ci): simplify REVIEW_BASE env var
- `3d3956d` - Merge pull request #42 - test-ai-review-workflow branch merged

### Evolution Pattern
The workflow has been iteratively refined through several PRs:
1. Initial working implementation (PR #42)
2. REVIEW_BASE simplification (82fa2dd)
3. Workflow reliability fixes (9c8c2f8, a1be8c4)
4. UI improvements - issue statistics (434b17e)
5. Documentation updates (multiple commits)

This research continues that evolution by adding:
- Structural improvements (composite action)
- Automation enhancements (labels, retry)
- Quantitative metrics (scoring)

### Lessons Learned Alignment

From `context/foundation/lessons.md`:

**Index Planning** (not applicable here - no database changes)

**After Regenerating Supabase Types** (not applicable - no schema changes)

The agent already loads and injects lessons.md content into the review prompt (see `src/review.ts:63-71` and `src/prompt.ts:95-96`), so new lessons will automatically influence future reviews.

## Related Research

This is the first research document for the `ai-code-review-config` change. Related context:

- **Foundation docs:**
  - `context/foundation/lessons.md` - Historical anti-patterns
  - `AGENTS.md` - Repository guidelines for AI agents
  - `CLAUDE.md` - Stack conventions and commands
  
- **Package docs:**
  - `packages/code-review-agent/README.md` - Review agent usage
  - `packages/code-review-agent/package.json` - Scripts and dependencies

- **Change-specific research artifacts:**
  - `context/changes/ai-code-review-config/composite-action-research.md` - Comprehensive composite action guide
  - `context/changes/ai-code-review-config/refactoring-example.md` - Before/after workflow comparison
  - `context/changes/ai-code-review-config/quick-reference.md` - Composite action cheat sheet
  - `context/changes/ai-code-review-config/label-management-guide.md` - PR label operations guide
  - `context/changes/ai-code-review-config/scoring-system-research.md` - Scoring algorithm and format design
  - `context/changes/ai-code-review-config/research-summary.md` - High-level findings overview

## Open Questions

1. **Score threshold configurability**: Should the 7.0 pass threshold be configurable via env var, or hardcoded in v1?
   - **Recommendation**: Hardcode for v1, add env var in v2 if needed

2. **Weighted criteria**: Should certain criteria (Security, Cloudflare CPU) be weighted higher than others?
   - **Recommendation**: Simple average for v1, collect feedback, add weighting in v2 if team requests

3. **Per-criterion minimums**: Should failing a critical criterion (e.g., Security < 5) block passing even if overall score ≥ 7.0?
   - **Recommendation**: No for v1 (too rigid), consider for v2 as optional "strict mode"

4. **NIT weight**: Should NITs contribute to scores (-0.5) or be purely informational (0)?
   - **Recommendation**: Keep -0.5 for v1 (light penalty maintains signal), adjust if too noisy

5. **Label cleanup**: Should the workflow remove `ai-cr:review` label after processing retry request?
   - **Recommendation**: Yes - remove after successful retry to prevent duplicate runs

6. **Score history tracking**: Should we track score trends over time (e.g., store in GitHub Actions cache or artifact)?
   - **Recommendation**: Out of scope for v1, consider separate metrics PR in future

7. **Manual override**: Should there be a way to bypass failed review (e.g., `ai-cr:override` label)?
   - **Recommendation**: Out of scope - review is advisory, doesn't block merging (GitHub branch protection is separate)

## Next Steps

Ready to proceed to planning phase. Recommended sequence:

1. **Plan phase** (`/10x-plan ai-code-review-config`)
   - Phase 1: Composite action refactoring (workflow restructuring)
   - Phase 2: Scoring system (prompt + output format changes)
   - Phase 3: Label management (workflow label logic)
   - Phase 4: Retry trigger (workflow trigger configuration)
   - Phase 5: Integration testing (end-to-end validation on draft PRs)

2. **Implementation considerations:**
   - Phases 1-2 can be implemented in parallel by different developers
   - Phase 3 depends on Phase 2 (needs score parsing)
   - Phase 4 is independent, can be done anytime after Phase 1
   - Phase 5 requires all phases complete

3. **Testing strategy:**
   - Use draft PR with known issues to verify scoring
   - Test label addition/removal manually
   - Test retry by adding `ai-cr:review` label
   - Verify comment upsert doesn't create duplicates
   - Check label colors render correctly in PR view

4. **Rollout:**
   - Keep backup of old workflow for 1 week
   - Monitor first 5 PRs closely
   - Document new label usage in AGENTS.md
   - Update code-review-agent README with scoring explanation
