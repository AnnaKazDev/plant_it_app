# Refactoring Example: Before & After

This document shows a side-by-side comparison of the current workflow and the proposed composite action refactoring.

---

## Current Structure (Before)

### File: `.github/workflows/ai-review.yml` (99 lines)

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
      # Setup steps
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: npm
          
      - run: npm ci
      - run: npm run review:install
      
      # Review execution (15 lines of bash logic)
      - name: Run review
        id: review
        run: |
          set +e
          npm run review > review-output.txt
          echo "exit_code=$?" >> $GITHUB_OUTPUT
          set -e
          sed -E 's/\x1B\[[0-9;]*[a-zA-Z]//g; s/\x1B\]8;;[^\x1B]*\x1B\\//g; s/\x1B\]8;;\x1B\\//g' review-output.txt > review-clean.txt || echo "No output" > review-clean.txt
          exit 0
        env:
          CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
          REVIEW_BASE: origin/main
          REVIEW_HEAD: ${{ github.sha }}
      
      # Comment posting (59 lines of JavaScript logic)
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

**Issues with current structure:**
- 🔴 Single file mixes setup, execution, and presentation logic
- 🔴 Hard to understand at a glance (need to read all 99 lines)
- 🔴 Review execution logic buried in bash script
- 🔴 Not reusable if another workflow needs review
- 🔴 Testing requires running entire workflow

---

## Proposed Structure (After)

### File 1: `.github/actions/ai-review/action.yml` (44 lines)

```yaml
name: 'Run AI Code Review'
description: 'Executes AI code review and generates findings report'

inputs:
  api-key:
    description: 'Cursor API key for AI review'
    required: true
  base-ref:
    description: 'Base reference for diff comparison'
    required: false
    default: 'origin/main'
  head-ref:
    description: 'Head reference for diff comparison'
    required: false
    default: ${{ github.sha }}

outputs:
  exit-code:
    description: 'Exit code from review process'
    value: ${{ steps.review.outputs.exit_code }}
  findings-file:
    description: 'Path to cleaned review findings'
    value: 'review-clean.txt'
  raw-file:
    description: 'Path to raw review output'
    value: 'review-output.txt'

runs:
  using: 'composite'
  steps:
    - name: Run AI review
      id: review
      shell: bash
      run: |
        set +e
        npm run review > review-output.txt
        echo "exit_code=$?" >> $GITHUB_OUTPUT
        set -e
      env:
        CURSOR_API_KEY: ${{ inputs.api-key }}
        REVIEW_BASE: ${{ inputs.base-ref }}
        REVIEW_HEAD: ${{ inputs.head-ref }}
    
    - name: Clean ANSI codes from output
      shell: bash
      run: |
        sed -E 's/\x1B\[[0-9;]*[a-zA-Z]//g; s/\x1B\]8;;[^\x1B]*\x1B\\//g; s/\x1B\]8;;\x1B\\//g' \
          review-output.txt > review-clean.txt || echo "No output" > review-clean.txt
```

### File 2: `.github/workflows/ai-review.yml` (91 lines, but much clearer)

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
      - run: npm run review:install
      
      # 🎯 Review execution extracted to composite action
      - name: Run AI review
        id: review
        uses: ./.github/actions/ai-review
        with:
          api-key: ${{ secrets.CURSOR_API_KEY }}
          base-ref: origin/main
          head-ref: ${{ github.sha }}
      
      # Comment posting logic remains in workflow (PR-specific)
      - name: Post PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const content = fs.existsSync('review-clean.txt') 
              ? fs.readFileSync('review-clean.txt', 'utf8') 
              : 'No output';
            const exitCode = '${{ steps.review.outputs.exit-code }}';
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

---

## Key Improvements

### 1. Separation of Concerns

**Before:** Everything in one file
```
Setup → Review → Comment (99 lines, all mixed)
```

**After:** Clear separation
```
Workflow: Setup → [Composite Action] → Comment
Action:   Review execution only
```

### 2. Easier to Reason About

**Before:** To understand review logic:
- Open `.github/workflows/ai-review.yml`
- Find the "Run review" step (line 27)
- Parse bash script with ANSI code cleanup
- Understand environment variables

**After:** To understand review logic:
- Open `.github/actions/ai-review/action.yml`
- Read documented inputs/outputs at top
- See two clear steps: run review, clean output

### 3. Explicit Interface

**Before:** Hidden contract
```yaml
- name: Run review
  id: review
  run: |
    # What does this output? What does it need?
    # Must read entire script to understand
```

**After:** Documented contract
```yaml
inputs:
  api-key:
    description: 'Cursor API key for AI review'
    required: true
  # ... more inputs

outputs:
  exit-code:
    description: 'Exit code from review process'
    value: ${{ steps.review.outputs.exit_code }}
  # ... more outputs
```

### 4. Reusability

**Before:** To use review in another workflow
- Copy-paste bash script
- Copy environment setup
- Hope nothing breaks

**After:** To use review in another workflow
```yaml
- uses: ./.github/actions/ai-review
  with:
    api-key: ${{ secrets.CURSOR_API_KEY }}
```

### 5. Testability

**Before:** Testing requires:
- Running entire workflow
- Full PR context
- All dependencies installed

**After:** Can test action independently:
```yaml
# test-workflow.yml
jobs:
  test:
    steps:
      - uses: ./.github/actions/ai-review
        with:
          api-key: ${{ secrets.TEST_KEY }}
```

---

## Visual Comparison

### Before: Monolithic Workflow

```
┌─────────────────────────────────────┐
│   .github/workflows/ai-review.yml   │
├─────────────────────────────────────┤
│  • Setup (checkout, node, deps)     │
│  • Review execution (bash script)   │
│  • Comment posting (JS script)      │
└─────────────────────────────────────┘
         ↓
   Single file: 99 lines
   Hard to navigate
   Mixed concerns
```

### After: Modular Structure

```
┌─────────────────────────────────────┐
│   .github/workflows/ai-review.yml   │
├─────────────────────────────────────┤
│  • Setup (checkout, node, deps)     │
│  • Use: ./.github/actions/ai-review │
│  • Comment posting (JS script)      │
└─────────────────────────────────────┘
         ↓
         ↓ uses
         ↓
┌─────────────────────────────────────┐
│  .github/actions/ai-review/action   │
├─────────────────────────────────────┤
│  Inputs:  api-key, base, head       │
│  Outputs: exit-code, files          │
│  Steps:   run review, clean output  │
└─────────────────────────────────────┘

Two focused files:
- Workflow: orchestration (91 lines)
- Action: review logic (44 lines)
Clear responsibilities
Easy to navigate
```

---

## Migration Steps

### Step 1: Create Action Directory

```bash
mkdir -p .github/actions/ai-review
```

### Step 2: Create `action.yml`

Copy the 44-line action definition from above into:
```
.github/actions/ai-review/action.yml
```

### Step 3: Update Workflow

Replace lines 27-39 (the "Run review" step) with:

```yaml
- name: Run AI review
  id: review
  uses: ./.github/actions/ai-review
  with:
    api-key: ${{ secrets.CURSOR_API_KEY }}
    base-ref: origin/main
    head-ref: ${{ github.sha }}
```

### Step 4: Update Output Reference

Change line 48 from:
```yaml
const exitCode = '${{ steps.review.outputs.exit_code }}';
```

To:
```yaml
const exitCode = '${{ steps.review.outputs.exit-code }}';
```

(Note: kebab-case in outputs, underscore in step internals)

### Step 5: Test on Feature Branch

```bash
git checkout -b refactor/composite-action
git add .github/actions/ai-review/action.yml
git add .github/workflows/ai-review.yml
git commit -m "refactor: extract review logic to composite action"
git push origin refactor/composite-action
```

Create PR and verify:
- ✅ Review runs successfully
- ✅ Exit code is captured
- ✅ PR comment is posted
- ✅ No errors in workflow logs

### Step 6: Merge

Once verified, merge to main.

---

## Rollback Plan

If something goes wrong, rollback is simple:

```bash
git revert <commit-sha>
git push origin main
```

Or temporarily restore the old workflow:

```bash
git show HEAD~1:.github/workflows/ai-review.yml > .github/workflows/ai-review.yml
git commit -m "temp: rollback to old workflow"
git push origin main
```

---

## Future Enhancements

Once composite action is working, you could:

1. **Add caching:** Cache npm dependencies in the action itself
2. **Add validation:** Validate inputs before running review
3. **Add retry logic:** Retry on transient failures
4. **Extract commenting:** Move comment logic to separate action
5. **Publish action:** Make it available to other repositories

---

## Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Workflow lines** | 99 | 91 | -8% (but much clearer) |
| **Files** | 1 | 2 | Focused separation |
| **Reusability** | None | High | Can use in other workflows |
| **Testability** | Hard | Easy | Test action independently |
| **Maintainability** | Low | High | Clear responsibilities |
| **Documented interface** | No | Yes | Inputs/outputs explicit |

**Recommendation:** Proceed with refactoring. The benefits far outweigh the minimal effort required.
