# GitHub Actions Composite Action Research

## 1. What is a Composite Action?

A **composite action** is a type of GitHub Action that allows you to bundle multiple workflow steps into a single reusable action. It's defined by an `action.yml` file and can combine multiple `run` steps and `uses` steps into one logical unit.

### Composite Action vs Reusable Workflow

| Feature | Composite Action | Reusable Workflow |
|---------|------------------|-------------------|
| **Location** | `.github/actions/<name>/action.yml` | `.github/workflows/<name>.yml` |
| **Scope** | Single job steps | Entire job(s) with multiple steps |
| **Usage** | `uses: ./.github/actions/<name>` | `uses: ./.github/workflows/<name>.yml` |
| **Secrets** | Passed explicitly as inputs | Can use `secrets: inherit` |
| **Outputs** | Via `outputs` section | Via job outputs |
| **Permissions** | Inherits from calling workflow | Can define own permissions |
| **Context** | Runs in same job, same runner | Runs in separate job |
| **Complexity** | Simpler, for step-level reuse | More complex, for job-level reuse |

**When to choose composite action:**
- You want to reuse a sequence of steps within a job
- You want the action to run on the same runner as the calling job
- You need lightweight, step-level abstraction
- **✅ Perfect for this use case:** Extract review logic while keeping main workflow simple

**When to choose reusable workflow:**
- You want to reuse entire jobs
- You need different permissions or runners
- You want matrix strategies at the job level

---

## 2. Composite Action Structure

### Basic `action.yml` Template

```yaml
name: 'Action Name'
description: 'Action description'

inputs:
  input-name:
    description: 'Input description'
    required: true
    default: 'default-value'

outputs:
  output-name:
    description: 'Output description'
    value: ${{ steps.step-id.outputs.output-name }}

runs:
  using: 'composite'
  steps:
    - name: Step name
      shell: bash
      run: |
        echo "Commands here"
```

### Key Components

1. **`runs.using: 'composite'`** — Required. Identifies this as a composite action.

2. **`inputs`** — Define parameters that can be passed to the action.
   - `description`: Human-readable description
   - `required`: `true` or `false`
   - `default`: Default value if not provided

3. **`outputs`** — Define values that the action returns to the workflow.
   - `value`: Expression referencing step outputs
   - Must use `${{ steps.<step-id>.outputs.<name> }}`

4. **`steps`** — The actual steps to execute.
   - **MUST** specify `shell:` for every `run` step (required for composite actions)
   - Can use `uses:` to call other actions
   - Can set outputs with `echo "name=value" >> $GITHUB_OUTPUT`

---

## 3. Handling Secrets in Composite Actions

**Critical limitation:** Composite actions **cannot** directly access `secrets` context.

### ❌ This Does NOT Work

```yaml
# Inside composite action
steps:
  - run: curl -H "Authorization: Bearer ${{ secrets.API_KEY }}"
    shell: bash
```

### ✅ Solution: Pass Secrets as Inputs

**In the composite action (`action.yml`):**

```yaml
inputs:
  api-key:
    description: 'API key for authentication'
    required: true

runs:
  using: 'composite'
  steps:
    - run: curl -H "Authorization: Bearer ${{ inputs.api-key }}"
      shell: bash
```

**In the calling workflow:**

```yaml
- uses: ./.github/actions/my-action
  with:
    api-key: ${{ secrets.API_KEY }}
```

### Best Practices for Secrets

1. **Mark inputs as required** when they contain secrets
2. **Use descriptive names** like `api-key`, `token`, `credentials`
3. **Don't echo or log** secret values in steps
4. **Pass explicitly** — don't rely on environment variables for secrets

---

## 4. Sharing Outputs from Composite Actions

Composite actions can return data to the calling workflow via outputs.

### Setting Outputs in Composite Action Steps

```yaml
# action.yml
outputs:
  exit-code:
    description: 'Exit code from review'
    value: ${{ steps.run-review.outputs.exit_code }}
  
  summary:
    description: 'Review summary'
    value: ${{ steps.process.outputs.summary }}

runs:
  using: 'composite'
  steps:
    - name: Run review
      id: run-review
      shell: bash
      run: |
        set +e
        npm run review
        echo "exit_code=$?" >> $GITHUB_OUTPUT
        set -e
    
    - name: Process results
      id: process
      shell: bash
      run: |
        SUMMARY=$(cat review-clean.txt | head -n 5)
        echo "summary<<EOF" >> $GITHUB_OUTPUT
        echo "$SUMMARY" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT
```

### Using Outputs in Calling Workflow

```yaml
jobs:
  review:
    steps:
      - uses: ./.github/actions/ai-review
        id: review-action
        with:
          api-key: ${{ secrets.API_KEY }}
      
      - name: Use outputs
        run: |
          echo "Exit code: ${{ steps.review-action.outputs.exit-code }}"
          echo "Summary: ${{ steps.review-action.outputs.summary }}"
```

### Multi-line Outputs

For multi-line strings, use the heredoc syntax:

```bash
echo "output-name<<EOF" >> $GITHUB_OUTPUT
echo "$MULTI_LINE_VALUE" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
```

---

## 5. Best Practices for Same-Repo Composite Actions

### Directory Structure

```
.github/
├── actions/
│   └── ai-review/
│       ├── action.yml          # Action definition
│       └── README.md           # Optional: action documentation
└── workflows/
    └── ai-review.yml           # Main workflow
```

### Versioning

For same-repo actions, reference by relative path:

```yaml
- uses: ./.github/actions/ai-review  # No version needed
```

For cross-repo actions, use Git refs:

```yaml
- uses: org/repo/.github/actions/my-action@v1  # Tag/branch/SHA
```

### Testing

1. **Local testing:** Use `act` tool to test actions locally
2. **Branch testing:** Test on feature branches before merging
3. **Matrix testing:** Test across different OS/versions if relevant

### Documentation

Create a `README.md` in the action directory:

```markdown
# AI Review Action

Runs AI code review and generates findings report.

## Inputs

- `api-key` (required): Cursor API key
- `base-ref` (optional): Base branch, default `origin/main`
- `head-ref` (optional): Head commit, default `github.sha`

## Outputs

- `exit-code`: Review process exit code
- `findings-file`: Path to review findings file

## Example

\`\`\`yaml
- uses: ./.github/actions/ai-review
  with:
    api-key: ${{ secrets.CURSOR_API_KEY }}
\`\`\`
```

### Action Maintenance

1. **Keep actions focused:** One responsibility per action
2. **Version carefully:** Breaking changes require major version bump (if published)
3. **Test changes:** Always test in CI before merging
4. **Document changes:** Update README and action description

---

## 6. Concrete Refactoring for Current Workflow

### Current State Analysis

The current `ai-review.yml` workflow has three logical sections:
1. **Setup** (checkout, Node.js setup, dependencies)
2. **Review execution** (run review, capture output, clean ANSI codes)
3. **Comment posting** (parse results, format comment, post/update PR comment)

### Refactoring Strategy

**Extract step 2 (review execution)** into a composite action:
- ✅ Focused responsibility
- ✅ Makes main workflow easier to read
- ✅ Reusable if needed in other workflows

**Keep setup and commenting in main workflow:**
- Setup is standard boilerplate
- Commenting uses `github-script` with specific PR context

### Proposed Structure

```
.github/
├── actions/
│   └── ai-review/
│       ├── action.yml          # Review execution logic
│       └── README.md
└── workflows/
    └── ai-review.yml           # Orchestration + PR commenting
```

---

## 7. Refactored Implementation

### Option A: Composite Action (Recommended)

**`.github/actions/ai-review/action.yml`**

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

**`.github/workflows/ai-review.yml`** (refactored)

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
      
      # 🎯 Use composite action
      - name: Run AI review
        id: review
        uses: ./.github/actions/ai-review
        with:
          api-key: ${{ secrets.CURSOR_API_KEY }}
          base-ref: origin/main
          head-ref: ${{ github.sha }}
      
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

**Benefits:**
- ✅ Main workflow is ~50% shorter and easier to scan
- ✅ Review logic is isolated and reusable
- ✅ Clear separation: action = execution, workflow = orchestration
- ✅ Action can be tested independently
- ✅ Inputs/outputs are explicitly documented

---

### Option B: Further Extraction (Advanced)

If you want to make the workflow even more minimal, you could also extract the commenting logic:

**`.github/actions/ai-review-comment/action.yml`**

```yaml
name: 'Post AI Review Comment'
description: 'Posts or updates PR comment with AI review findings'

inputs:
  findings-file:
    description: 'Path to review findings file'
    required: true
    default: 'review-clean.txt'
  exit-code:
    description: 'Exit code from review'
    required: true
  github-token:
    description: 'GitHub token for API access'
    required: true

runs:
  using: 'composite'
  steps:
    - uses: actions/github-script@v7
      with:
        github-token: ${{ inputs.github-token }}
        script: |
          const fs = require('fs');
          const content = fs.existsSync('${{ inputs.findings-file }}') 
            ? fs.readFileSync('${{ inputs.findings-file }}', 'utf8') 
            : 'No output';
          const exitCode = '${{ inputs.exit-code }}';
          
          // ... rest of comment logic ...
```

**Main workflow becomes ultra-minimal:**

```yaml
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
      
      - uses: ./.github/actions/ai-review
        id: review
        with:
          api-key: ${{ secrets.CURSOR_API_KEY }}
      
      - uses: ./.github/actions/ai-review-comment
        if: always()
        with:
          findings-file: ${{ steps.review.outputs.findings-file }}
          exit-code: ${{ steps.review.outputs.exit-code }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Trade-offs:**
- ✅ Even more modular
- ✅ Each action has single responsibility
- ⚠️ More files to maintain
- ⚠️ May be over-engineering for a single workflow

---

## 8. Migration Checklist

### Pre-migration
- [ ] Read current workflow and understand all steps
- [ ] Identify which steps to extract (review execution)
- [ ] List all inputs needed (secrets, refs)
- [ ] List all outputs needed (exit code, files)

### Implementation
- [ ] Create `.github/actions/ai-review/` directory
- [ ] Write `action.yml` with inputs/outputs
- [ ] Copy review steps with `shell: bash` specified
- [ ] Update main workflow to use action
- [ ] Pass secrets as inputs
- [ ] Reference outputs with correct path

### Testing
- [ ] Test on feature branch first
- [ ] Verify secrets are passed correctly
- [ ] Verify outputs are accessible
- [ ] Verify PR comments work
- [ ] Check for any error logs

### Documentation
- [ ] Add README.md to action directory
- [ ] Document inputs/outputs
- [ ] Add usage example
- [ ] Update main workflow comments if needed

---

## 9. Common Pitfalls & Solutions

### ❌ Problem: Forgot `shell:` in composite action

```yaml
runs:
  using: 'composite'
  steps:
    - run: echo "test"  # ❌ ERROR: missing shell
```

**✅ Solution:** Always specify shell

```yaml
runs:
  using: 'composite'
  steps:
    - run: echo "test"
      shell: bash  # ✅ Required
```

---

### ❌ Problem: Trying to access secrets directly

```yaml
# Inside action.yml
steps:
  - run: echo ${{ secrets.API_KEY }}  # ❌ ERROR: secrets not available
    shell: bash
```

**✅ Solution:** Pass as input

```yaml
# action.yml
inputs:
  api-key:
    required: true

runs:
  using: 'composite'
  steps:
    - run: echo ${{ inputs.api-key }}  # ✅
      shell: bash
```

---

### ❌ Problem: Output not accessible in workflow

```yaml
# action.yml
outputs:
  exit-code:
    value: ${{ steps.review.outputs.exit_code }}  # ❌ Wrong step ID
```

**✅ Solution:** Match step ID exactly

```yaml
runs:
  using: 'composite'
  steps:
    - name: Run review
      id: review  # ✅ Must match
      shell: bash
      run: echo "exit_code=0" >> $GITHUB_OUTPUT

outputs:
  exit-code:
    value: ${{ steps.review.outputs.exit_code }}  # ✅ Correct reference
```

---

### ❌ Problem: Action not found

```yaml
- uses: ./.github/actions/ai-review  # ❌ No action.yml in directory
```

**✅ Solution:** Ensure `action.yml` exists

```
.github/actions/ai-review/
└── action.yml  # ✅ Must be named exactly "action.yml"
```

---

## 10. Additional Resources

- [GitHub Docs: Creating a composite action](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [GitHub Docs: Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
- [GitHub Docs: Workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)
- [Composite actions examples](https://github.com/actions)

---

## Summary

**For your use case, Option A (single composite action for review execution) is recommended:**

1. ✅ Meets requirements: main workflow is easier to reason about
2. ✅ Clear separation: action = review, workflow = orchestration
3. ✅ Secrets handled correctly (passed as inputs)
4. ✅ Outputs work for exit code and file paths
5. ✅ Not over-engineered (single action, clear purpose)
6. ✅ Easy to test and maintain

**Next steps:**
1. Create `.github/actions/ai-review/action.yml`
2. Refactor `.github/workflows/ai-review.yml`
3. Test on feature branch
4. Merge when verified
