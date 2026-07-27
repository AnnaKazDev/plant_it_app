# Composite Actions Quick Reference

A cheat sheet for GitHub Actions composite actions.

---

## When to Use Composite Actions

✅ **Use when:**
- Reusing a sequence of steps within a job
- Extracting complex logic for clarity
- Same runner, same job context
- Step-level abstraction

❌ **Don't use when:**
- Need separate jobs with different permissions
- Need different runners (OS/architecture)
- Need matrix strategies at job level
- → Use reusable workflows instead

---

## Minimal Example

```yaml
# .github/actions/example/action.yml
name: 'Example Action'
description: 'Does something useful'

inputs:
  name:
    description: 'Your name'
    required: true

outputs:
  greeting:
    description: 'Generated greeting'
    value: ${{ steps.greet.outputs.message }}

runs:
  using: 'composite'
  steps:
    - id: greet
      shell: bash
      run: |
        echo "message=Hello ${{ inputs.name }}!" >> $GITHUB_OUTPUT
```

**Usage:**

```yaml
# .github/workflows/example.yml
jobs:
  test:
    steps:
      - uses: ./.github/actions/example
        id: action
        with:
          name: World
      
      - run: echo "${{ steps.action.outputs.greeting }}"
```

---

## Critical Rules

### 1. Always Specify `shell:`

```yaml
# ❌ WRONG
runs:
  using: 'composite'
  steps:
    - run: echo "test"

# ✅ CORRECT
runs:
  using: 'composite'
  steps:
    - run: echo "test"
      shell: bash
```

### 2. Pass Secrets as Inputs

```yaml
# ❌ WRONG - secrets not available in composite actions
runs:
  using: 'composite'
  steps:
    - run: echo ${{ secrets.API_KEY }}
      shell: bash

# ✅ CORRECT
inputs:
  api-key:
    required: true

runs:
  using: 'composite'
  steps:
    - run: echo ${{ inputs.api-key }}
      shell: bash

# In calling workflow:
- uses: ./.github/actions/example
  with:
    api-key: ${{ secrets.API_KEY }}
```

### 3. Reference Outputs Correctly

```yaml
outputs:
  result:
    value: ${{ steps.STEP_ID.outputs.OUTPUT_NAME }}
    #           ^^^^^^^^         ^^^^^^^^^^^
    #           Must match step id and output name
```

---

## Setting Outputs

### Single-line output

```bash
echo "key=value" >> $GITHUB_OUTPUT
```

### Multi-line output (heredoc)

```bash
echo "key<<EOF" >> $GITHUB_OUTPUT
echo "$MULTI_LINE_VALUE" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
```

---

## Input Types

```yaml
inputs:
  required-input:
    description: 'Required parameter'
    required: true
  
  optional-input:
    description: 'Optional parameter'
    required: false
    default: 'default-value'
  
  secret-input:
    description: 'Secret value (passed from workflow)'
    required: true
```

---

## Directory Structure

```
.github/
├── actions/
│   ├── action-name-1/
│   │   ├── action.yml       # Required: must be named exactly "action.yml"
│   │   └── README.md        # Optional: documentation
│   └── action-name-2/
│       └── action.yml
└── workflows/
    └── workflow.yml
```

---

## Referencing Actions

### Same repository

```yaml
- uses: ./.github/actions/my-action
```

### Different repository

```yaml
# Tag
- uses: org/repo/.github/actions/my-action@v1

# Branch
- uses: org/repo/.github/actions/my-action@main

# Commit SHA
- uses: org/repo/.github/actions/my-action@abc1234
```

---

## Using Other Actions in Composite Actions

You can call other actions from within a composite action:

```yaml
runs:
  using: 'composite'
  steps:
    # Use external action
    - uses: actions/checkout@v4
    
    # Use another local action
    - uses: ./.github/actions/other-action
      with:
        param: value
    
    # Run commands
    - run: npm install
      shell: bash
```

---

## Environment Variables

### Passing env vars to steps

```yaml
runs:
  using: 'composite'
  steps:
    - run: echo $MY_VAR
      shell: bash
      env:
        MY_VAR: ${{ inputs.some-input }}
```

### Accessing GitHub context

```yaml
runs:
  using: 'composite'
  steps:
    - run: echo "Repo: ${{ github.repository }}"
      shell: bash
    
    - run: echo "SHA: ${{ github.sha }}"
      shell: bash
```

---

## Conditional Steps

```yaml
runs:
  using: 'composite'
  steps:
    - name: Always runs
      shell: bash
      run: echo "Always"
    
    - name: Conditional
      if: inputs.condition == 'true'
      shell: bash
      run: echo "Only if condition"
    
    - name: On failure
      if: failure()
      shell: bash
      run: echo "Previous step failed"
```

---

## Working Directory

```yaml
runs:
  using: 'composite'
  steps:
    - run: pwd
      shell: bash
      working-directory: ./subdirectory
```

---

## Common Patterns

### Capture exit code

```yaml
runs:
  using: 'composite'
  steps:
    - id: run-command
      shell: bash
      run: |
        set +e
        npm test
        echo "exit_code=$?" >> $GITHUB_OUTPUT
        set -e

outputs:
  exit-code:
    value: ${{ steps.run-command.outputs.exit_code }}
```

### Handle errors gracefully

```yaml
runs:
  using: 'composite'
  steps:
    - id: try-command
      shell: bash
      run: |
        if some-command; then
          echo "success=true" >> $GITHUB_OUTPUT
        else
          echo "success=false" >> $GITHUB_OUTPUT
          echo "error=Command failed" >> $GITHUB_OUTPUT
        fi
```

### File operations

```yaml
runs:
  using: 'composite'
  steps:
    - shell: bash
      run: |
        if [[ -f "file.txt" ]]; then
          echo "File exists"
          CONTENT=$(cat file.txt)
          echo "content=$CONTENT" >> $GITHUB_OUTPUT
        else
          echo "File not found"
          exit 1
        fi
```

---

## Debugging

### Enable debug logging

In the repository settings or via secret:
```yaml
ACTIONS_STEP_DEBUG: true
ACTIONS_RUNNER_DEBUG: true
```

Then use in action:

```yaml
runs:
  using: 'composite'
  steps:
    - shell: bash
      run: |
        echo "::debug::This is a debug message"
        echo "::notice::This is a notice"
        echo "::warning::This is a warning"
        echo "::error::This is an error"
```

### Print inputs for debugging

```yaml
runs:
  using: 'composite'
  steps:
    - name: Debug inputs
      shell: bash
      run: |
        echo "Input 1: ${{ inputs.input1 }}"
        echo "Input 2: ${{ inputs.input2 }}"
```

---

## Testing

### Local testing with `act`

```bash
# Install act
brew install act  # macOS
# or download from: https://github.com/nektos/act

# Run workflow locally
act pull_request

# Run specific job
act pull_request -j job-name

# With secrets
act pull_request -s GITHUB_TOKEN=xxx
```

### Test action in isolation

Create a test workflow:

```yaml
# .github/workflows/test-action.yml
name: Test Action
on: [workflow_dispatch]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: ./.github/actions/my-action
        id: test
        with:
          input1: test-value
      
      - run: echo "Output: ${{ steps.test.outputs.output1 }}"
```

---

## Common Mistakes & Solutions

| Mistake | Solution |
|---------|----------|
| Forgot `shell:` | Add `shell: bash` to every `run` step |
| Tried to use `secrets` | Pass secrets as `inputs` from workflow |
| Wrong output reference | Match step `id:` exactly in outputs |
| Action not found | Ensure file is named `action.yml` |
| Output not passed | Set with `echo "key=value" >> $GITHUB_OUTPUT` |
| Multi-line output broken | Use heredoc syntax with EOF |
| Permissions issue | Permissions set at workflow level, not action |
| Can't find files | Check working directory and runner context |

---

## Composite Action vs Reusable Workflow

| Feature | Composite Action | Reusable Workflow |
|---------|------------------|-------------------|
| **File location** | `.github/actions/` | `.github/workflows/` |
| **Called with** | `uses: ./.github/actions/name` | `uses: ./.github/workflows/name.yml` |
| **Runs in** | Same job | Separate job |
| **Secrets** | Explicit inputs | `secrets: inherit` |
| **Permissions** | Inherit from job | Can define own |
| **Outputs** | Simple | Via job outputs |
| **Best for** | Step sequences | Complete jobs |

---

## Resources

- [GitHub Docs: Composite actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [Metadata syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
- [Workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)
- [Example: actions/checkout](https://github.com/actions/checkout/blob/main/action.yml)
- [Example: actions/setup-node](https://github.com/actions/setup-node/blob/main/action.yml)

---

## Summary Checklist

Before creating a composite action:
- [ ] Identified reusable step sequence
- [ ] Listed all required inputs
- [ ] Listed all required outputs
- [ ] Checked if secrets are needed (will pass as inputs)
- [ ] Decided on action name and location

When writing `action.yml`:
- [ ] Set `runs.using: 'composite'`
- [ ] Added `shell:` to every `run` step
- [ ] Defined all `inputs` with descriptions
- [ ] Defined all `outputs` with correct step references
- [ ] Used `${{ inputs.* }}` for inputs
- [ ] Used `echo "key=value" >> $GITHUB_OUTPUT` for outputs
- [ ] Added input validation if needed

Before deploying:
- [ ] Created action directory: `.github/actions/<name>/`
- [ ] Created `action.yml` file
- [ ] Updated calling workflow to use action
- [ ] Passed secrets as inputs
- [ ] Referenced outputs correctly
- [ ] Tested on feature branch
- [ ] Verified outputs are accessible
- [ ] Checked workflow logs for errors

---

**Remember:** Composite actions make your workflows cleaner and more maintainable. Start simple, iterate, and refactor as needed.
