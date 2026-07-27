# AI Code Review Configuration Enhancement - Implementation Plan

## Overview

Enhance the existing working code-review workflow with four key improvements while preserving all current functionality (colors, issue statistics, PR comment format):

1. **Composite action structure** - refactor workflow for better maintainability
2. **10-criteria scoring system** - add quantitative metrics (1-10 scale per criterion)
3. **Automatic PR labels** - `ai-cr:passed` / `ai-cr:failed` based on score
4. **On-demand retry** - trigger review by adding `ai-cr:review` label

The enhancement builds on a solid foundation: Cursor SDK-based agent with precomputed diffs, working tree guards, exit code semantics, and lessons.md integration.

## Current State Analysis

### What Exists Today

**Packages/code-review-agent/** (standalone CLI agent):
- `src/review.ts` - orchestrates env loading, git operations, agent execution, streaming
- `src/prompt.ts` - builds review prompt with 10 criteria + diff injection
- `src/formatter.ts` - line-buffered formatter with ANSI colors + OSC 8 file links
- `src/git.ts` - precomputes triple-dot diffs (500KB cap), ref resolution, status snapshots
- `src/env.ts` - selective loader (only `CURSOR_*`/`REVIEW_*`, never leaks app secrets)

**GitHub Actions workflow** (`.github/workflows/ai-review.yml`):
- Triggers on `pull_request` to `main`
- Steps: checkout → Node setup → npm ci → review:install → run review → comment
- Comment step: counts severity markers (BLOCKER/MAJOR/MINOR/NIT), upserts PR comment
- Current format: shows emoji, status text, issue statistics in header, detailed review in collapsible section

**Key characteristics to preserve:**
- ✅ Colors in local CLI output (`formatter.ts` ANSI codes)
- ✅ PR comment header with pass/fail indicator and issue counts
- ✅ Collapsible details section
- ✅ Working tree guard (exit 3 if modified)
- ✅ Exit code semantics (0/1/2/3)
- ✅ Lessons.md loading and injection

### What's Missing

1. **Workflow structure** - monolithic 99-line workflow, review logic not isolated
2. **Quantitative metrics** - no scoring, only severity markers (hard to track improvement)
3. **PR labels** - no automatic labeling (manual triage needed)
4. **Retry mechanism** - no way to re-run review without pushing new commit

## Desired End State

### User Experience After Implementation

**For PR authors:**
- Open PR → automatic review comment appears within 1-2 minutes
- Comment shows: overall score (e.g., "8.2/10 — ✅ PASS"), issue statistics (e.g., "2 major, 3 minor"), and detailed findings
- PR automatically labeled: `ai-cr:passed` (green) or `ai-cr:failed` (red)
- Can retry review by adding `ai-cr:review` label (label auto-removed after retry)

**For reviewers:**
- Clear pass/fail signal via label color
- Quantitative score enables tracking quality trends over time
- Issue statistics preserved for quick triage

**For maintainers:**
- Cleaner workflow structure (composite action isolates review logic)
- Easy to test review changes locally: `npm run review`
- Explicit input/output interface for future extensions

### Technical End State

**Structure:**
```
.github/
├── actions/
│   └── ai-review/
│       └── action.yml          # Review execution (install, run, strip ANSI, output)
└── workflows/
    └── ai-review.yml           # Orchestration (setup, action, labels, comment)
```

**Prompt output format** (`packages/code-review-agent/src/prompt.ts`):
```markdown
## Code Review Score: 8.2/10 — ✅ PASS

### Score Breakdown

| Criterion | Score | Grade | Issues |
|:----------|------:|:-----:|:-------|
| 1. Stack Conventions | 9/10 | 🟢 | 0 blocker, 1 major, 0 minor, 0 nit |
[... 10 rows total ...]

---

### Summary
[Existing format preserved]

### Findings
[Existing format preserved]
```

**PR comment format** (preserves current structure, adds score):
```markdown
## 🤖 AI Review ✅

**Status:** Score: 8.2/10 | 12 findings (0 blocker, 2 major, 8 minor, 2 nit)

<details>
<summary>View detailed review</summary>

[Full review output with scoring table + findings]

</details>
```

## What We're NOT Doing

- ❌ Changing exit code semantics or error handling
- ❌ Modifying formatter colors or output structure (local CLI)
- ❌ Removing or changing existing issue severity markers (BLOCKER/MAJOR/MINOR/NIT)
- ❌ Adding weighted criteria (simple average in v1, can add later)
- ❌ Per-criterion minimum thresholds (too rigid for v1)
- ❌ Configurable pass threshold (hardcoded 7.0 for v1)
- ❌ Score history tracking across PRs (future enhancement)
- ❌ Branch protection integration (review is advisory, doesn't block merging)
- ❌ Auto-fix suggestions (out of scope)

## Implementation Approach

### Strategy

Sequential implementation to minimize risk and enable easy rollback:
1. Manual setup (labels) → independent prerequisite
2. Structural refactoring (composite action) → improves maintainability, no functional change
3. Scoring system (prompt) → adds quantitative metrics, preserves existing output
4. Label automation (workflow) → consumes scoring output
5. Retry trigger (workflow) → independent enhancement
6. Thorough testing (3-5 draft PRs) → validate before production
7. Documentation & cleanup → capture new patterns

### Key Decisions

| Decision | Choice | Rationale | Source |
|----------|--------|-----------|--------|
| **Composite action vs reusable workflow** | Composite action | Step-level reuse, lighter weight, same runner context | Research |
| **Scoring algorithm** | Deduction model: start at 10, deduct per severity | Simple, transparent, aligns with existing severity markers | Research |
| **Pass threshold** | Hardcoded 7.0/10 | Industry standard "Good" tier, keep v1 simple | Plan (user confirmed) |
| **Label creation method** | Manual in repo settings | Simpler than API, one-time 2-minute task | Plan (user confirmed) |
| **Implementation order** | Sequential (7 phases) | Minimize risk, clear dependencies, easy rollback | Plan (user confirmed) |
| **Label cleanup** | Remove `ai-cr:review` after retry | Prevents duplicate runs | Plan (user confirmed) |
| **Testing depth** | Thorough (3-5 draft PRs) | Balance between speed and confidence | Plan (user confirmed) |
| **Rollback strategy** | Keep backup workflow for 1 week | Quick revert if issues arise | Plan (user confirmed) |

### Deduction Algorithm Details

**Per criterion:**
- Start at 10 points
- Deduct: 🔴 BLOCKER (-3), 🟡 MAJOR (-2), 🟢 MINOR (-1), ⚪ NIT (-0.5)
- Floor at 1 (minimum score)
- Round to nearest integer

**Overall score:**
- Simple average of 10 criteria (e.g., (9+10+8+...+10)/10 = 8.2)
- Pass if ≥ 7.0, fail if < 7.0

**Examples:**
- 1 blocker: 10 - 3 = 7/10 (still passing, but flagged)
- 2 blockers: 10 - 6 = 4/10 (failing)
- 10 minor issues: 10 - 10 = 0 → floor at 1/10 (failing)

## Phase 1: Label Creation (Manual Setup)

### Overview

One-time manual creation of 3 PR labels in GitHub repo settings. Prerequisite for all subsequent phases.

### Changes Required:

#### 1. Create Labels in GitHub UI

**Intent**: Create 3 labels with specific names and colors to support pass/fail/retry workflow.

**Contract**: 
- `ai-cr:passed` - color `0e8a16` (green) - description "AI code review passed"
- `ai-cr:failed` - color `d73a4a` (red) - description "AI code review failed"  
- `ai-cr:review` - color `1d76db` (blue) - description "Trigger AI code review retry"

**Steps**:
1. Navigate to repository → Issues → Labels
2. Click "New label"
3. Create each label with exact name, color (6-digit hex), and description above

### Success Criteria:

#### Manual Verification:

- All 3 labels visible in repo labels list
- Colors match specification (green/red/blue)
- Labels can be added/removed from test issue manually

---

## Phase 2: Composite Action Refactoring

### Overview

Extract review execution logic from main workflow into `.github/actions/ai-review/action.yml`. This is a structural refactoring with **zero functional changes** - workflow behavior remains identical, just better organized.

### Changes Required:

#### 1. Create Composite Action

**File**: `.github/actions/ai-review/action.yml`

**Intent**: Package review execution steps (install deps, run review, strip ANSI) into reusable action with explicit inputs/outputs.

**Contract**:

Inputs:
- `api-key` (required) - Cursor API key for agent
- `model` (optional, default `composer-2.5`) - Model ID
- `base-ref` (optional, default `origin/main`) - Base git ref
- `head-ref` (optional, default SHA) - Head git ref

Outputs:
- `exit-code` - Review script exit code (0/1/2/3)
- `review-output` - Path to cleaned review text file

```yaml
name: AI Code Review
description: Run code review agent and output results
inputs:
  api-key:
    description: Cursor API key
    required: true
  model:
    description: Model ID for review
    required: false
    default: composer-2.5
  base-ref:
    description: Base git ref for diff
    required: false
    default: origin/main
  head-ref:
    description: Head git ref for diff
    required: false
    default: ${{ github.sha }}
outputs:
  exit-code:
    description: Review exit code
    value: ${{ steps.review.outputs.exit_code }}
  review-output:
    description: Path to cleaned review output
    value: review-clean.txt
runs:
  using: composite
  steps:
    - name: Install review package
      shell: bash
      run: npm run review:install
      
    - name: Run review
      id: review
      shell: bash
      run: |
        set +e
        npm run review > review-output.txt
        echo "exit_code=$?" >> $GITHUB_OUTPUT
        set -e
        sed -E 's/\x1B\[[0-9;]*[a-zA-Z]//g; s/\x1B\]8;;[^\x1B]*\x1B\\//g; s/\x1B\]8;;\x1B\\//g' review-output.txt > review-clean.txt || echo "No output" > review-clean.txt
      env:
        CURSOR_API_KEY: ${{ inputs.api-key }}
        CURSOR_MODEL: ${{ inputs.model }}
        REVIEW_BASE: ${{ inputs.base-ref }}
        REVIEW_HEAD: ${{ inputs.head-ref }}
```

#### 2. Update Main Workflow

**File**: `.github/workflows/ai-review.yml`

**Intent**: Replace inline review steps with composite action call, preserving all existing behavior (triggers, permissions, comment logic).

**Contract**: Workflow triggers, permissions, and comment format remain identical. Only the review execution is delegated to composite action.

Before (current structure):
```yaml
- run: npm ci
- run: npm run review:install
- name: Run review
  run: [inline review + ANSI stripping]
- name: Comment
  uses: actions/github-script@v7
  # ... existing comment logic
```

After (refactored):
```yaml
- run: npm ci

- name: Run AI Review
  id: review
  uses: ./.github/actions/ai-review
  with:
    api-key: ${{ secrets.CURSOR_API_KEY }}
    base-ref: origin/main
    head-ref: ${{ github.sha }}
    
- name: Comment
  uses: actions/github-script@v7
  # ... existing comment logic (unchanged)
```

**Full workflow after refactoring**:

```yaml
name: AI Code Review

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: npm
          
      - run: npm ci
      
      - name: Run AI Review
        id: review
        uses: ./.github/actions/ai-review
        with:
          api-key: ${{ secrets.CURSOR_API_KEY }}
          base-ref: origin/main
          head-ref: ${{ github.sha }}
      
      - name: Comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const content = fs.existsSync('review-clean.txt') ? fs.readFileSync('review-clean.txt', 'utf8') : 'No output';
            const exitCode = '${{ steps.review.outputs.exit_code }}';
            const marker = '<!-- ai-review -->';
            
            const blockerCount = (content.match(/BLOCKER/g) || []).length;
            const majorCount = (content.match(/MAJOR/g) || []).length;
            const minorCount = (content.match(/MINOR/g) || []).length;
            const nitCount = (content.match(/NIT/g) || []).length;
            const totalIssues = blockerCount + majorCount + minorCount + nitCount;
            
            let statusText = 'No issues found';
            let emoji = '✅';
            
            if (exitCode !== '0') {
              statusText = 'Review failed';
              emoji = '❌';
            } else if (totalIssues > 0) {
              const parts = [];
              if (blockerCount > 0) parts.push(blockerCount + ' blocker' + (blockerCount > 1 ? 's' : ''));
              if (majorCount > 0) parts.push(majorCount + ' major');
              if (minorCount > 0) parts.push(minorCount + ' minor');
              if (nitCount > 0) parts.push(nitCount + ' nit' + (nitCount > 1 ? 's' : ''));
              statusText = parts.join(', ');
              if (blockerCount > 0) emoji = '🔴';
              else if (majorCount > 0) emoji = '🟡';
            }
            
            const body = marker + '\n## 🤖 AI Review ' + emoji + '\n\n**Status:** ' + statusText + '\n\n<details>\n<summary>View detailed findings</summary>\n\n' + content + '\n\n</details>\n\n---\n<sub>Powered by [Cursor SDK](https://cursor.com/docs/sdk/typescript)</sub>';
            
            const {data: comments} = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number
            });
            
            const existing = comments.find(c => c.body && c.body.includes(marker));
            
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body
              });
            }
```

#### 3. Create Backup

**File**: `.github/workflows/ai-review.yml.bak`

**Intent**: Keep backup of original workflow for easy rollback if issues arise.

**Contract**: Copy current workflow before making changes. Delete after 1 week of successful operation.

```bash
cp .github/workflows/ai-review.yml .github/workflows/ai-review.yml.bak
```

### Success Criteria:

#### Automated Verification:

- Composite action file exists at `.github/actions/ai-review/action.yml`
- Workflow file parses correctly: `npx action-validator .github/workflows/ai-review.yml` (if available)
- No syntax errors in YAML files

#### Manual Verification:

- Open test PR, verify workflow runs successfully
- Check workflow logs: composite action steps appear under "Run AI Review"
- Verify PR comment appears with existing format (emoji, status, issue counts)
- Compare comment to previous PR comments - format should be identical
- Verify exit code handling: try PR with known issues, check emoji changes (🟢 → 🟡 or 🔴)

---

## Phase 3: Scoring System Implementation

### Overview

Add 10-criteria scoring system (1-10 scale) to review output. Each criterion starts at 10 and deducts points based on findings. Output includes scoring table at top, followed by existing detailed findings (preserved).

### Changes Required:

#### 1. Update Prompt with Scoring Methodology

**File**: `packages/code-review-agent/src/prompt.ts`

**Intent**: Add scoring instructions and output format specification to agent prompt. Scoring table appears before existing Summary/Findings sections.

**Contract**: Insert new sections after existing "Review criteria" section (currently lines 36-96) and before "Output format" section (currently lines 98-131).

**New sections to insert**:

After line 96 (end of criteria 10), add:

```typescript
## Scoring methodology

Score each criterion on a 1–10 scale using this deduction algorithm:
1. Start at 10 points
2. Deduct: 🔴 BLOCKER (-3), 🟡 MAJOR (-2), 🟢 MINOR (-1), ⚪ NIT (-0.5)
3. Floor at 1 (minimum score)
4. Round to nearest integer

For each criterion, count findings that apply to it and calculate the score. A finding applies to multiple criteria if it violates multiple rules (e.g., security + code quality).

Calculate overall score as the simple average of all 10 criteria, rounded to one decimal place.

Pass threshold: ≥ 7.0/10
```

Then update the "Output format" section (currently starting at line 98):

```typescript
## Output format (strict markdown)

Begin with the scoring table showing all 10 criteria, then provide detailed findings.

### Code Review Score: X.X/10 — [✅ PASS | 🔴 FAIL]

### Score Breakdown

| Criterion | Score | Grade | Issues |
|:----------|------:|:-----:|:-------|
| 1. Stack Conventions | X/10 | emoji | 0 blocker, 0 major, 0 minor, 0 nit |
| 2. Tailwind | X/10 | emoji | No findings |
| 3. Supabase | X/10 | emoji | issue summary |
| 4. Cloudflare CPU | X/10 | emoji | issue summary |
| 5. Security | X/10 | emoji | issue summary |
| 6. Code Quality | X/10 | emoji | issue summary |
| 7. Testing | X/10 | emoji | issue summary |
| 8. Performance | X/10 | emoji | issue summary |
| 9. Logic & Errors | X/10 | emoji | issue summary |
| 10. Lessons Learned | X/10 | emoji | issue summary |

Grade emojis: 🟢 (8-10), 🟡 (5-7), 🔴 (1-4)

If any criterion scored ≤ 4, add after the table:
**Critical areas:** [criterion name] (X/10) — [brief explanation]

---

[Then continue with existing format:]

### Summary
[2-4 sentences describing goal and scope]

### Findings
[Existing format with severity markers, locations, issues, fixes - unchanged]

### Questions
[Optional clarifying questions - unchanged]
```

**Implementation note**: The existing output format structure (Summary, Findings with severity markers, Questions) is preserved - we're adding the scoring table at the top, not replacing anything.

### Success Criteria:

#### Automated Verification:

- TypeScript compilation passes: `npm run typecheck --prefix packages/code-review-agent`
- Prompt string builds correctly (no syntax errors)

#### Manual Verification:

- Run `npm run review --prefix packages/code-review-agent` on test branch with known issues
- Verify output starts with scoring table (10 rows, proper markdown)
- Verify overall score calculation (e.g., if all criteria are 8-10, overall should be ~8-9)
- Verify grade emojis match score ranges (🟢 for 8-10, 🟡 for 5-7, 🔴 for 1-4)
- Verify existing sections appear after scoring table (Summary, Findings, Questions)
- Test edge cases:
  - Clean PR (no issues) → all 10/10, overall 10.0, ✅ PASS
  - PR with 2 blockers → affected criteria show 4/10 (10-3-3), overall likely <7.0, 🔴 FAIL
  - PR with only nits → criteria show 9-10/10, overall ≥7.0, ✅ PASS
- Verify markdown renders correctly when copied to GitHub comment

---

## Phase 4: Label Management Integration

### Overview

Update workflow to parse scoring output, apply PR labels based on pass/fail result, and enhance PR comment header to show both score and issue statistics.

### Changes Required:

#### 1. Update Comment Step to Parse Score

**File**: `.github/workflows/ai-review.yml`

**Intent**: Extract overall score from review output, determine pass/fail, add appropriate label, and update comment header to show score + issue statistics.

**Contract**: Replace existing "Comment" step (currently lines ~41-99) with enhanced version that:
1. Parses overall score via regex
2. Determines pass/fail (≥7.0 = passed)
3. Removes old `ai-cr:*` labels atomically
4. Adds new label (`ai-cr:passed` or `ai-cr:failed`)
5. Updates comment header to show score + issue statistics

**New comment step**:

```yaml
- name: Comment and Label
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const content = fs.existsSync('review-clean.txt') ? fs.readFileSync('review-clean.txt', 'utf8') : 'No output';
      const exitCode = '${{ steps.review.outputs.exit_code }}';
      const marker = '<!-- ai-review -->';
      
      // Extract overall score from output
      const scoreMatch = content.match(/## Code Review Score: ([\d.]+)\/10/);
      const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;
      
      // Count issues (existing logic preserved)
      const blockerCount = (content.match(/🔴 BLOCKER/g) || []).length;
      const majorCount = (content.match(/🟡 MAJOR/g) || []).length;
      const minorCount = (content.match(/🟢 MINOR/g) || []).length;
      const nitCount = (content.match(/⚪ NIT/g) || []).length;
      const totalIssues = blockerCount + majorCount + minorCount + nitCount;
      
      // Determine pass/fail and label
      let passed = overallScore !== null && overallScore >= 7.0;
      let newLabel = passed ? 'ai-cr:passed' : 'ai-cr:failed';
      
      // Build status text (score + issue statistics)
      let statusText = '';
      let emoji = '✅';
      
      if (exitCode !== '0') {
        statusText = 'Review failed';
        emoji = '❌';
        newLabel = 'ai-cr:failed';
      } else if (overallScore !== null) {
        const issuesPart = totalIssues > 0 
          ? ` | ${totalIssues} findings (${blockerCount} blocker, ${majorCount} major, ${minorCount} minor, ${nitCount} nit)`
          : ' | No issues found';
        statusText = `Score: ${overallScore}/10${issuesPart}`;
        emoji = passed ? '✅' : '🔴';
      } else {
        // Fallback if score parsing failed
        statusText = totalIssues > 0 
          ? `${totalIssues} findings (${blockerCount} blocker, ${majorCount} major, ${minorCount} minor, ${nitCount} nit)`
          : 'No issues found';
        if (blockerCount > 0) emoji = '🔴';
        else if (majorCount > 0) emoji = '🟡';
      }
      
      // Build comment body (existing format preserved, status text enhanced)
      const body = marker + '\n## 🤖 AI Review ' + emoji + '\n\n**Status:** ' + statusText + '\n\n<details>\n<summary>View detailed review</summary>\n\n' + content + '\n\n</details>\n\n---\n<sub>Powered by [Cursor SDK](https://cursor.com/docs/sdk/typescript)</sub>';
      
      // Upsert comment (existing logic preserved)
      const {data: comments} = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number
      });
      
      const existing = comments.find(c => c.body && c.body.includes(marker));
      
      if (existing) {
        await github.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existing.id,
          body
        });
      } else {
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body
        });
      }
      
      // Atomic label replacement: remove old ai-cr:* labels, add new
      const {data: labels} = await github.rest.issues.listLabelsOnIssue({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number
      });
      
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
            // Ignore 404 (label already removed by concurrent workflow)
            if (e.status !== 404) throw e;
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

**Comment format after changes**:

Pass example (score ≥ 7.0):
```
## 🤖 AI Review ✅

**Status:** Score: 8.2/10 | 12 findings (0 blocker, 2 major, 8 minor, 2 nit)

<details>...</details>
```

Fail example (score < 7.0):
```
## 🤖 AI Review 🔴

**Status:** Score: 5.5/10 | 8 findings (2 blocker, 3 major, 3 minor, 0 nit)

<details>...</details>
```

### Success Criteria:

#### Automated Verification:

- Workflow YAML parses correctly
- No syntax errors in JavaScript code

#### Manual Verification:

- Open draft PR with clean code
  - Verify comment shows "Score: 10.0/10 | No issues found" with ✅
  - Verify `ai-cr:passed` label added (green color)
- Open draft PR with minor issues (score should be 8-9)
  - Verify comment shows score + issue counts
  - Verify `ai-cr:passed` label added
- Open draft PR with 2 blockers (score should be <7.0)
  - Verify comment shows score + issue counts with 🔴
  - Verify `ai-cr:failed` label added (red color)
- Update existing labeled PR
  - Verify old label removed, new label added (atomic replacement)
  - Verify no duplicate labels
- Check label colors in PR list view (green/red)

---

## Phase 5: Retry Trigger Configuration

### Overview

Add ability to re-run review on-demand by adding `ai-cr:review` label to PR. Workflow triggers on label addition, runs review, and removes the label after processing.

### Changes Required:

#### 1. Add Label Trigger to Workflow

**File**: `.github/workflows/ai-review.yml`

**Intent**: Trigger workflow on `labeled` event in addition to existing `opened`/`synchronize` events. Filter to run only when `ai-cr:review` label is added or on normal PR events.

**Contract**: Update workflow `on` section and add conditional to `review` job.

Replace current trigger (lines 3-5):
```yaml
on:
  pull_request:
    branches: [main]
```

With:
```yaml
on:
  pull_request:
    types: [opened, synchronize, labeled]
    branches: [main]
```

Add conditional to `review` job (after line 11, before `runs-on`):
```yaml
jobs:
  review:
    # Run on PR open/update OR when ai-cr:review label added
    if: |
      github.event.action != 'labeled' || 
      github.event.label.name == 'ai-cr:review'
    runs-on: ubuntu-latest
```

#### 2. Add Label Cleanup Step

**File**: `.github/workflows/ai-review.yml`

**Intent**: Remove `ai-cr:review` label after review completes (whether success or failure) to prevent duplicate runs.

**Contract**: Add new step after "Comment and Label" step, runs only when triggered by label.

```yaml
- name: Remove retry label
  if: github.event.action == 'labeled' && github.event.label.name == 'ai-cr:review'
  uses: actions/github-script@v7
  with:
    script: |
      try {
        await github.rest.issues.removeLabel({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          name: 'ai-cr:review'
        });
      } catch (e) {
        // Ignore 404 if label already removed
        if (e.status !== 404) throw e;
      }
```

### Success Criteria:

#### Automated Verification:

- Workflow YAML parses correctly
- Conditional syntax is valid

#### Manual Verification:

- Open draft PR, wait for initial review to complete
- Manually add `ai-cr:review` label via GitHub UI
- Verify workflow triggers (check Actions tab)
- Verify review runs successfully
- Verify `ai-cr:review` label is removed after completion
- Verify appropriate `ai-cr:passed` or `ai-cr:failed` label added (based on score)
- Verify PR comment updates with new review results
- Test error case: add label, cancel workflow mid-run
  - Verify label is NOT removed (expected: manual cleanup needed if workflow doesn't complete)

---

## Phase 6: Integration Testing

### Overview

Thorough testing with 3-5 draft PRs covering various scenarios (clean code, issues, retry, edge cases) before enabling on real PRs.

### Changes Required:

#### 1. Create Test Branch with Clean Code

**Intent**: Verify scoring, labeling, and comment format work correctly when no issues found.

**Contract**: Create branch with passing code (follows all conventions), open draft PR.

Test checklist:
- [ ] All 10 criteria score 10/10
- [ ] Overall score is 10.0/10
- [ ] Comment shows "Score: 10.0/10 | No issues found" with ✅
- [ ] `ai-cr:passed` label added (green)
- [ ] Detailed review shows scoring table with all 🟢 emojis
- [ ] Summary section says "✅ No findings. Code looks good."

#### 2. Create Test Branch with Minor/Major Issues

**Intent**: Verify scoring deduction algorithm, issue counting, and appropriate labeling.

**Contract**: Create branch with 2-3 deliberate violations:
- 1 Tailwind concatenation (MAJOR) → criterion 2 should be 8/10
- 2 missing edge case checks (MINOR) → criterion 9 should be 8/10

Test checklist:
- [ ] Affected criteria show reduced scores (8/10)
- [ ] Unaffected criteria remain 10/10
- [ ] Overall score is 9.2-9.5/10 (should be ≥7.0 = passing)
- [ ] Comment shows "Score: X.X/10 | 3 findings (0 blocker, 1 major, 2 minor, 0 nit)" with ✅
- [ ] `ai-cr:passed` label added (green)
- [ ] Detailed findings show file:line references for each issue
- [ ] Fixes are provided in code blocks

#### 3. Create Test Branch with Blockers

**Intent**: Verify failing score (<7.0), appropriate emoji and label.

**Contract**: Create branch with 2 security blockers:
- Hardcoded API key in code (BLOCKER)
- Missing zod validation on API endpoint (BLOCKER)

Test checklist:
- [ ] Security criterion shows 4/10 (10 - 3 - 3 = 4)
- [ ] Overall score is <7.0/10 (failing)
- [ ] Comment shows "Score: X.X/10 | N findings (...2 blocker...)" with 🔴
- [ ] `ai-cr:failed` label added (red)
- [ ] "Critical areas" section appears after scoring table mentioning Security
- [ ] Detailed findings clearly explain security issues with fixes

#### 4. Test Retry Mechanism

**Intent**: Verify `ai-cr:review` label triggers re-run and is cleaned up afterward.

**Contract**: Use PR from test 3 (failing), fix 1 blocker, manually add `ai-cr:review` label.

Test checklist:
- [ ] Adding label triggers workflow (visible in Actions tab)
- [ ] Review runs successfully
- [ ] `ai-cr:review` label removed after completion
- [ ] Security criterion improves to 7/10 (10 - 3 = 7, one blocker fixed)
- [ ] Overall score may still be <7.0 or ≥7.0 depending on fix
- [ ] Label updates: old `ai-cr:failed` removed, new label added based on score
- [ ] Comment updates with new review (not duplicate comment)

#### 5. Test Edge Cases

**Intent**: Verify edge case handling (empty diff, review failure, concurrent runs).

**Contract**: Test unusual scenarios:

**Empty diff** (PR with no code changes):
- [ ] Review exits with code 0 (success)
- [ ] Comment shows "No changes to review" or similar
- [ ] Label added is `ai-cr:passed` (no issues = pass)

**Review agent error** (simulate by temporarily removing CURSOR_API_KEY secret):
- [ ] Workflow fails gracefully
- [ ] Comment shows "Review failed" with ❌
- [ ] Exit code is 1 or 2
- [ ] `ai-cr:failed` label added

**Concurrent label additions** (add `ai-cr:review` twice quickly):
- [ ] Both workflows trigger
- [ ] First to complete removes label
- [ ] Second workflow exits early (label condition fails) or completes normally
- [ ] No duplicate comments or labels

### Success Criteria:

#### Automated Verification:

- All test PRs trigger workflow successfully
- No workflow failures in Actions tab
- All exit codes are 0 (or 1/2 for error cases, as expected)

#### Manual Verification:

- All test checklists above completed successfully
- No regressions in existing functionality (compare comment format to pre-enhancement PRs)
- Label colors correct (green/red/blue)
- Comment collapsible section works (click to expand/collapse)
- Review output renders correctly as markdown (tables, code blocks, severity markers)
- No duplicate comments or labels

**Implementation Note**: After all tests pass, pause for review before enabling on production PRs. If any test fails, debug and iterate before proceeding.

---

## Phase 7: Documentation & Cleanup

### Overview

Update documentation to explain new scoring system and label usage. Clean up backup workflow after 1 week of successful operation.

### Changes Required:

#### 1. Update code-review-agent README

**File**: `packages/code-review-agent/README.md`

**Intent**: Add section explaining scoring system for future contributors and users running local reviews.

**Contract**: Add new section after existing "Usage" section (around line 30-40).

```markdown
## Scoring System

The code review agent scores PRs on a 1-10 scale across 10 criteria:

1. Stack Conventions (Astro + React + Cloudflare)
2. Tailwind Class Handling
3. Supabase Patterns
4. Cloudflare Workers Constraints
5. Security & Validation
6. Code Quality & TypeScript
7. Testing
8. Performance & Optimization
9. Logic & Error Handling
10. Lessons Learned Compliance

### Scoring Algorithm

Each criterion starts at 10 points and deducts based on findings:
- 🔴 BLOCKER: -3 points
- 🟡 MAJOR: -2 points
- 🟢 MINOR: -1 point
- ⚪ NIT: -0.5 points

Scores are floored at 1 (minimum) and rounded to nearest integer. The overall score is the simple average of all 10 criteria.

**Pass threshold:** ≥ 7.0/10

### Output Format

Review output includes:
- **Scoring table** at top (10 criteria with scores and grade emojis)
- **Overall score** (e.g., "8.2/10 — ✅ PASS")
- **Summary** section (goal and scope of changes)
- **Findings** section (detailed issues with file:line, severity, fixes)
- **Questions** section (optional clarifications)

Example output:
```markdown
## Code Review Score: 8.2/10 — ✅ PASS

### Score Breakdown
[table with 10 rows...]

---

### Summary
[description...]

### Findings
**🟡 MAJOR**
**Location:** `src/components/Button.tsx:15`
...
```

### PR Labels

The GitHub Actions workflow automatically adds labels:
- `ai-cr:passed` (green) - Score ≥ 7.0
- `ai-cr:failed` (red) - Score < 7.0
- `ai-cr:review` (blue) - Add manually to trigger retry

To retry a review without pushing new commits, add the `ai-cr:review` label to the PR. The workflow will re-run and remove the label after completion.
```

#### 2. Update AGENTS.md

**File**: `AGENTS.md`

**Intent**: Document PR label usage and retry mechanism for AI agents working in this repo.

**Contract**: Add new section after "Deployment" section (around line 60-70).

```markdown
## AI Code Review

All PRs to `main` automatically trigger AI code review via GitHub Actions.

### Review Output

- PR comment with overall score (1-10 scale), issue statistics, and detailed findings
- Automatic labeling: `ai-cr:passed` (green, score ≥7.0) or `ai-cr:failed` (red, score <7.0)
- Review evaluates 10 criteria: Stack Conventions, Tailwind, Supabase, Cloudflare CPU, Security, Code Quality, Testing, Performance, Logic/Errors, Lessons Learned

### Retry Review

To re-run review without pushing new commits:
1. Add `ai-cr:review` label to PR (manually via GitHub UI)
2. Workflow triggers and runs review
3. Label is removed automatically after completion

### Scoring Algorithm

Each criterion starts at 10 points, deducts based on findings:
- 🔴 BLOCKER: -3 | 🟡 MAJOR: -2 | 🟢 MINOR: -1 | ⚪ NIT: -0.5

Overall score = average of 10 criteria. Pass threshold: 7.0/10.

### Local Testing

Test review locally before pushing:
```bash
npm run review:install
npm run review -- --base main --head HEAD
```
```

#### 3. Remove Backup Workflow

**File**: `.github/workflows/ai-review.yml.bak`

**Intent**: Clean up backup after 1 week of successful operation (5+ PRs with no issues).

**Contract**: Delete file after monitoring period confirms stability.

```bash
rm .github/workflows/ai-review.yml.bak
```

### Success Criteria:

#### Automated Verification:

- Markdown files render correctly (no broken links or formatting)
- README and AGENTS.md pass linting (if applicable)

#### Manual Verification:

- README section renders correctly on GitHub
- AGENTS.md section renders correctly on GitHub
- Code examples are syntax-highlighted
- Links work (e.g., Cursor SDK link in comment footer)
- Backup workflow deleted after monitoring period

---

## Testing Strategy

### Unit Tests

Not applicable - no new testable logic in agent code (prompt changes only affect LLM output).

### Integration Tests

**Existing test suite** (`packages/code-review-agent`):
- No changes needed - git helpers, env loading, formatter remain unchanged
- If integration tests exist, run them: `npm run test:integration --prefix packages/code-review-agent`

### Manual Testing Steps

Covered comprehensively in Phase 6. Summary:

1. **Clean code PR** - verify 10.0 score, passed label, correct comment format
2. **Minor/major issues PR** - verify score deduction, issue counts, passed label (if ≥7.0)
3. **Blocker issues PR** - verify failing score (<7.0), failed label, critical areas section
4. **Retry mechanism** - verify label trigger, label cleanup, comment update
5. **Edge cases** - verify empty diff, agent error, concurrent runs

### Rollback Testing

**Before enabling on production**:
1. Restore `.github/workflows/ai-review.yml.bak`
2. Open test PR
3. Verify old behavior (no scoring, no labels, existing comment format)
4. Confirm rollback works in <5 minutes

## Performance Considerations

**No significant performance impact expected:**

- Composite action refactoring: neutral (same steps, just reorganized)
- Scoring system: prompt is ~100 lines longer, adds ~500 tokens to response (scoring table). Estimated impact: +5-10s per review (agent already takes 1-2 min total).
- Label management: adds 2-3 GitHub API calls (list labels, remove, add). Impact: +0.5-1s.
- Retry trigger: no change to normal PR flow (conditional skips `labeled` events without `ai-cr:review`).

**Monitoring:**
- Check workflow run times in Actions tab before/after changes
- If reviews start taking >3 minutes consistently, investigate prompt optimization

## Migration Notes

Not applicable - this is an enhancement to existing system, not a data migration. No database changes, no breaking API changes.

**Considerations:**
- Old PRs will not have labels (only new PRs after Phase 4)
- Cannot retroactively score old PRs (would require re-running agent on historical PRs)
- Backup workflow preserved for 1 week to enable easy rollback

## References

- Research document: `context/changes/ai-code-review-config/research.md`
- Composite action guide: `context/changes/ai-code-review-config/composite-action-research.md`
- Refactoring example: `context/changes/ai-code-review-config/refactoring-example.md`
- Label management guide: `context/changes/ai-code-review-config/label-management-guide.md`
- Scoring system design: `context/changes/ai-code-review-config/scoring-system-research.md`
- Requirements: `context/changes/ai-code-review-config/requirements.md`
- Current workflow: `.github/workflows/ai-review.yml:1-99`
- Current prompt: `packages/code-review-agent/src/prompt.ts:5-132`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Label Creation (Manual Setup)

#### Manual

- [x] 1.1 All 3 labels visible in repo labels list — d4d909f
- [x] 1.2 Colors match specification (green/red/blue) — d4d909f
- [x] 1.3 Labels can be added/removed from test issue manually — d4d909f

### Phase 2: Composite Action Refactoring

#### Automated

- [x] 2.1 Composite action file exists at `.github/actions/ai-review/action.yml`
- [x] 2.2 Workflow file parses correctly
- [x] 2.3 No syntax errors in YAML files

#### Manual

- [ ] 2.4 Open test PR, verify workflow runs successfully
- [ ] 2.5 Check workflow logs: composite action steps appear under "Run AI Review"
- [ ] 2.6 Verify PR comment appears with existing format (emoji, status, issue counts)
- [ ] 2.7 Compare comment to previous PR comments - format should be identical
- [ ] 2.8 Verify exit code handling: try PR with known issues, check emoji changes

### Phase 3: Scoring System Implementation

#### Automated

- [ ] 3.1 TypeScript compilation passes
- [ ] 3.2 Prompt string builds correctly (no syntax errors)

#### Manual

- [ ] 3.3 Run review on test branch with known issues
- [ ] 3.4 Verify output starts with scoring table (10 rows, proper markdown)
- [ ] 3.5 Verify overall score calculation
- [ ] 3.6 Verify grade emojis match score ranges
- [ ] 3.7 Verify existing sections appear after scoring table
- [ ] 3.8 Test edge case: clean PR (all 10/10, overall 10.0, PASS)
- [ ] 3.9 Test edge case: PR with 2 blockers (overall <7.0, FAIL)
- [ ] 3.10 Test edge case: PR with only nits (overall ≥7.0, PASS)
- [ ] 3.11 Verify markdown renders correctly when copied to GitHub comment

### Phase 4: Label Management Integration

#### Automated

- [ ] 4.1 Workflow YAML parses correctly
- [ ] 4.2 No syntax errors in JavaScript code

#### Manual

- [ ] 4.3 Draft PR with clean code: verify comment shows score + "No issues found" with ✅
- [ ] 4.4 Draft PR with clean code: verify `ai-cr:passed` label added (green)
- [ ] 4.5 Draft PR with minor issues: verify comment shows score + issue counts
- [ ] 4.6 Draft PR with minor issues: verify `ai-cr:passed` label added
- [ ] 4.7 Draft PR with 2 blockers: verify comment shows score + issue counts with 🔴
- [ ] 4.8 Draft PR with 2 blockers: verify `ai-cr:failed` label added (red)
- [ ] 4.9 Update existing labeled PR: verify old label removed, new label added
- [ ] 4.10 Verify no duplicate labels
- [ ] 4.11 Check label colors in PR list view (green/red)

### Phase 5: Retry Trigger Configuration

#### Automated

- [ ] 5.1 Workflow YAML parses correctly
- [ ] 5.2 Conditional syntax is valid

#### Manual

- [ ] 5.3 Add `ai-cr:review` label manually: verify workflow triggers
- [ ] 5.4 Verify review runs successfully
- [ ] 5.5 Verify `ai-cr:review` label removed after completion
- [ ] 5.6 Verify appropriate `ai-cr:passed` or `ai-cr:failed` label added
- [ ] 5.7 Verify PR comment updates with new review results
- [ ] 5.8 Test error case: add label, cancel workflow mid-run

### Phase 6: Integration Testing

#### Automated

- [ ] 6.1 All test PRs trigger workflow successfully
- [ ] 6.2 No workflow failures in Actions tab
- [ ] 6.3 All exit codes are 0 (or 1/2 for error cases, as expected)

#### Manual

- [ ] 6.4 Test 1: Clean code PR (all criteria 10/10, overall 10.0, passed label)
- [ ] 6.5 Test 2: Minor/major issues PR (reduced scores, overall ≥7.0, passed label)
- [ ] 6.6 Test 3: Blocker issues PR (overall <7.0, failed label, critical areas section)
- [ ] 6.7 Test 4: Retry mechanism (label trigger, cleanup, comment update)
- [ ] 6.8 Test 5: Edge cases (empty diff, agent error, concurrent runs)
- [ ] 6.9 No regressions in existing functionality
- [ ] 6.10 Review output renders correctly as markdown

### Phase 7: Documentation & Cleanup

#### Automated

- [ ] 7.1 Markdown files render correctly (no broken links or formatting)
- [ ] 7.2 README and AGENTS.md pass linting (if applicable)

#### Manual

- [ ] 7.3 README section renders correctly on GitHub
- [ ] 7.4 AGENTS.md section renders correctly on GitHub
- [ ] 7.5 Code examples are syntax-highlighted
- [ ] 7.6 Links work (e.g., Cursor SDK link)
- [ ] 7.7 Backup workflow deleted after monitoring period (1 week, 5+ PRs)
