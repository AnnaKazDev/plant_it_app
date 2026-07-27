# Composite Action Research Summary

Research completed: **Monday, Jul 27, 2026**

## What Was Researched

How to convert `.github/workflows/ai-review.yml` into a composite action pattern to make the main workflow "easy to reason about" per requirements.md.

---

## Key Findings

### 1. What is a Composite Action?

A **composite action** is a GitHub Actions feature that bundles multiple workflow steps into a single reusable action defined by an `action.yml` file. It allows step-level reuse within the same job/runner.

**vs Reusable Workflow:**
- Composite action = step-level, same job, lighter weight
- Reusable workflow = job-level, separate job, more complex

**✅ Composite action is the right choice** for this use case.

### 2. Structure

```yaml
name: 'Action Name'
description: 'Description'

inputs:
  input-name:
    description: 'Description'
    required: true

outputs:
  output-name:
    description: 'Description'
    value: ${{ steps.step-id.outputs.name }}

runs:
  using: 'composite'
  steps:
    - shell: bash  # Required!
      run: echo "commands"
```

**Critical requirements:**
- Must specify `shell:` for every `run` step
- File must be named `action.yml`
- Must set `runs.using: 'composite'`

### 3. Secrets Handling

**Composite actions CANNOT access `secrets` context directly.**

**Solution:** Pass secrets as inputs from the calling workflow.

```yaml
# action.yml
inputs:
  api-key:
    required: true

runs:
  using: 'composite'
  steps:
    - run: echo ${{ inputs.api-key }}
      shell: bash

# workflow.yml
- uses: ./.github/actions/my-action
  with:
    api-key: ${{ secrets.API_KEY }}
```

### 4. Outputs

Composite actions can return data via outputs.

**Setting output in action:**

```bash
echo "key=value" >> $GITHUB_OUTPUT
```

**Declaring in action.yml:**

```yaml
outputs:
  exit-code:
    description: 'Exit code'
    value: ${{ steps.step-id.outputs.exit_code }}
```

**Accessing in workflow:**

```yaml
- uses: ./.github/actions/my-action
  id: action
- run: echo "${{ steps.action.outputs.exit-code }}"
```

### 5. Best Practices

✅ **Do:**
- Keep actions focused (single responsibility)
- Document inputs/outputs clearly
- Use descriptive names
- Test on feature branches
- Add README.md to action directory

❌ **Don't:**
- Forget `shell:` on run steps
- Try to access secrets directly
- Over-engineer (keep it simple)
- Use for job-level reuse (use reusable workflows)

---

## Recommended Refactoring

### Proposed Structure

```
.github/
├── actions/
│   └── ai-review/
│       ├── action.yml          # Review execution logic
│       └── README.md           # Documentation
└── workflows/
    └── ai-review.yml           # Orchestration + PR commenting
```

### What Goes Where

**Composite Action (`.github/actions/ai-review/action.yml`):**
- Review execution (`npm run review`)
- Output cleanup (ANSI code stripping)
- Exit code capture

**Main Workflow (`.github/workflows/ai-review.yml`):**
- Setup (checkout, Node.js, dependencies)
- Call composite action
- PR comment posting (PR-specific logic)

### Benefits

| Before | After |
|--------|-------|
| 99 lines in one file | 44-line action + 91-line workflow |
| Mixed concerns | Clear separation |
| Hard to understand | Easy to scan |
| Not reusable | Reusable in other workflows |
| Hard to test | Test action independently |
| No documentation | Explicit inputs/outputs |

---

## Implementation Plan

### Step 1: Create Action

Create `.github/actions/ai-review/action.yml` with:
- Inputs: `api-key`, `base-ref`, `head-ref`
- Outputs: `exit-code`, `findings-file`, `raw-file`
- Steps: run review, clean output

### Step 2: Refactor Workflow

Update `.github/workflows/ai-review.yml`:
- Replace "Run review" step with composite action call
- Pass secrets as inputs
- Update output references

### Step 3: Test

1. Create feature branch
2. Test workflow runs
3. Verify outputs
4. Check PR comments
5. Merge when verified

### Rollback

If needed, simply revert the commit or restore old workflow.

---

## Research Documents Created

1. **`composite-action-research.md`** (comprehensive guide)
   - What are composite actions?
   - vs Reusable workflows
   - Structure and syntax
   - Secrets handling
   - Outputs
   - Best practices
   - Common pitfalls
   - Additional resources

2. **`refactoring-example.md`** (before/after comparison)
   - Current structure analysis
   - Proposed structure with full code
   - Side-by-side comparison
   - Visual diagrams
   - Migration steps
   - Rollback plan
   - Future enhancements

3. **`quick-reference.md`** (cheat sheet)
   - Minimal examples
   - Critical rules
   - Common patterns
   - Debugging tips
   - Testing strategies
   - Common mistakes
   - Quick lookup table

4. **`research-summary.md`** (this document)
   - High-level overview
   - Key findings
   - Implementation plan
   - Document index

---

## Questions Answered

### 1. What is a GitHub Actions composite action?

A composite action bundles multiple workflow steps into a single reusable unit defined by `action.yml`. It's used for step-level reuse within the same job.

### 2. How does it differ from a reusable workflow?

| | Composite Action | Reusable Workflow |
|-|------------------|-------------------|
| **Scope** | Step-level | Job-level |
| **Context** | Same job | Separate job |
| **Location** | `.github/actions/` | `.github/workflows/` |
| **Complexity** | Simpler | More complex |

### 3. How to structure the action.yml file?

```yaml
name: '...'
description: '...'
inputs: { ... }
outputs: { ... }
runs:
  using: 'composite'
  steps: [...]
```

Key: must use `shell:` for every run step.

### 4. How to pass secrets to composite actions?

Pass as inputs from workflow:

```yaml
# action.yml
inputs:
  api-key: { required: true }

# workflow.yml
with:
  api-key: ${{ secrets.API_KEY }}
```

### 5. How to share outputs?

Set in step:
```bash
echo "key=value" >> $GITHUB_OUTPUT
```

Declare in action:
```yaml
outputs:
  key:
    value: ${{ steps.step-id.outputs.key }}
```

Access in workflow:
```yaml
${{ steps.action-id.outputs.key }}
```

### 6. Best practices?

- Keep focused (single responsibility)
- Document inputs/outputs
- Pass secrets explicitly
- Test on feature branches
- Use meaningful names
- Add README.md

---

## Concrete Next Steps

1. **Read the research documents**
   - Start with `refactoring-example.md` for practical before/after
   - Use `quick-reference.md` as a cheat sheet during implementation
   - Consult `composite-action-research.md` for deep dives

2. **Implement the refactoring**
   - Create `.github/actions/ai-review/action.yml`
   - Update `.github/workflows/ai-review.yml`
   - Test on feature branch
   - Verify all outputs work
   - Merge when ready

3. **Optional enhancements**
   - Add `README.md` to action directory
   - Consider extracting comment logic (future)
   - Add input validation
   - Add retry logic

---

## Conclusion

**Recommendation: Proceed with composite action refactoring.**

The research shows clear benefits:
- ✅ Meets requirements (easier to reason about)
- ✅ Clear separation of concerns
- ✅ Reusable and testable
- ✅ Explicit interface
- ✅ Minimal migration effort
- ✅ Easy rollback if needed

**Time estimate:**
- Implementation: 15-30 minutes
- Testing: 10-15 minutes
- Total: ~30-45 minutes

**Risk: Low**
- Simple refactoring
- No logic changes
- Easy to test
- Easy to rollback

**Impact: High**
- Much clearer workflow
- Better maintainability
- Reusable for future needs

---

## Files in This Research

```
context/changes/ai-code-review-config/
├── requirements.md                    # Original requirements
├── composite-action-research.md       # Comprehensive guide (10 sections)
├── refactoring-example.md             # Before/after comparison
├── quick-reference.md                 # Cheat sheet
└── research-summary.md                # This document
```

**Recommended reading order:**
1. `research-summary.md` (this file) - overview
2. `refactoring-example.md` - practical examples
3. `quick-reference.md` - during implementation
4. `composite-action-research.md` - deep dives as needed

---

**Research completed by:** AI Agent  
**Date:** Monday, Jul 27, 2026  
**Status:** ✅ Ready for implementation
