# GitHub Actions PR Label Management Guide

This guide covers implementing PR label management for the AI code review workflow.

## Overview

The code review workflow uses three labels:
- `ai-cr:passed` (green) - Review completed with no issues
- `ai-cr:failed` (red) - Review found issues requiring attention
- `ai-cr:review` - Manual trigger label for on-demand reviews

## 1. Adding/Removing Labels with `actions/github-script@v7`

### Add Labels

Use `github.rest.issues.addLabels` (PRs are treated as issues in the GitHub API):

```yaml
- name: Add passed label
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.addLabels({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        labels: ['ai-cr:passed']
      })
```

### Remove a Single Label

Use `github.rest.issues.removeLabel`:

```yaml
- name: Remove failed label
  uses: actions/github-script@v7
  with:
    script: |
      try {
        await github.rest.issues.removeLabel({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          name: 'ai-cr:failed'
        })
      } catch (error) {
        // Ignore 404 if label doesn't exist
        if (error.status !== 404) {
          throw error;
        }
      }
```

### Remove Multiple Labels (Replace Pattern)

To replace `ai-cr:failed` with `ai-cr:passed`, remove old labels first:

```yaml
- name: Update review labels
  uses: actions/github-script@v7
  with:
    script: |
      const labelsToRemove = ['ai-cr:failed', 'ai-cr:passed', 'ai-cr:review'];
      
      // Get current labels
      const { data: currentLabels } = await github.rest.issues.listLabelsOnIssue({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo
      });
      
      // Remove old ai-cr labels
      for (const labelToRemove of labelsToRemove) {
        if (currentLabels.some(label => label.name === labelToRemove)) {
          try {
            await github.rest.issues.removeLabel({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              name: labelToRemove
            });
            console.log(`Removed label: ${labelToRemove}`);
          } catch (error) {
            console.log(`Failed to remove ${labelToRemove}: ${error.message}`);
          }
        }
      }
      
      // Add new label
      const newLabel = '${{ steps.review.outputs.passed }}' === 'true' 
        ? 'ai-cr:passed' 
        : 'ai-cr:failed';
      
      await github.rest.issues.addLabels({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        labels: [newLabel]
      });
```

## 2. Trigger Workflow on Label Addition

Configure the workflow to listen for the `labeled` event:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches:
      - main

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    # Skip if this is just a label event but not the trigger label
    if: |
      github.event_name != 'pull_request' ||
      github.event.action != 'labeled' ||
      github.event.label.name == 'ai-cr:review'
    steps:
      - name: Check trigger
        run: |
          echo "Event: ${{ github.event_name }}"
          echo "Action: ${{ github.event.action }}"
          echo "Label: ${{ github.event.label.name }}"
```

### Alternative: Separate Workflow for Manual Trigger

Create a dedicated workflow that only runs on the `ai-cr:review` label:

```yaml
name: AI Code Review (Manual)

on:
  pull_request:
    types: [labeled]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    if: github.event.label.name == 'ai-cr:review'
    runs-on: ubuntu-latest
    steps:
      - name: Remove trigger label
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.removeLabel({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              name: 'ai-cr:review'
            })
      
      - name: Run review
        # ... review steps ...
```

## 3. Check if Specific Label Was Added

Use `github.event.label.name` in job conditionals:

```yaml
jobs:
  review:
    if: |
      (github.event.action != 'labeled') || 
      (github.event.label.name == 'ai-cr:review')
    runs-on: ubuntu-latest
```

Or check within a step:

```yaml
- name: Check if manual trigger
  id: check-trigger
  run: |
    if [[ "${{ github.event.action }}" == "labeled" ]] && \
       [[ "${{ github.event.label.name }}" == "ai-cr:review" ]]; then
      echo "manual=true" >> $GITHUB_OUTPUT
    else
      echo "manual=false" >> $GITHUB_OUTPUT
    fi

- name: Run manual review
  if: steps.check-trigger.outputs.manual == 'true'
  run: echo "Manual review triggered"
```

You can also check if a label currently exists (regardless of when it was added):

```yaml
- name: Check for label presence
  uses: actions/github-script@v7
  with:
    script: |
      const hasLabel = context.payload.pull_request.labels
        .some(label => label.name === 'ai-cr:review');
      console.log(`Has review label: ${hasLabel}`);
      return hasLabel;
```

## 4. Replace Labels (Remove Old, Add New)

Complete example that replaces labels atomically:

```yaml
- name: Update review status labels
  uses: actions/github-script@v7
  with:
    script: |
      const prNumber = context.issue.number;
      const owner = context.repo.owner;
      const repo = context.repo.repo;
      const reviewPassed = ${{ steps.review.outputs.passed }};
      
      // Define label names
      const AI_LABELS = ['ai-cr:passed', 'ai-cr:failed', 'ai-cr:review'];
      const newLabel = reviewPassed ? 'ai-cr:passed' : 'ai-cr:failed';
      
      // Get current labels
      const { data: labels } = await github.rest.issues.listLabelsOnIssue({
        issue_number: prNumber,
        owner,
        repo
      });
      
      // Remove all AI review labels
      for (const label of labels) {
        if (AI_LABELS.includes(label.name)) {
          await github.rest.issues.removeLabel({
            issue_number: prNumber,
            owner,
            repo,
            name: label.name
          }).catch(err => {
            console.log(`Could not remove ${label.name}: ${err.message}`);
          });
        }
      }
      
      // Add the new label
      await github.rest.issues.addLabels({
        issue_number: prNumber,
        owner,
        repo,
        labels: [newLabel]
      });
      
      console.log(`Updated label to: ${newLabel}`);
```

## 5. Label Color Configuration

### Option A: Create Labels Manually (Recommended)

Labels must be created in the repository before they can be used. You can:

1. Go to repository → Issues → Labels
2. Click "New label"
3. Create each label with the desired color:
   - `ai-cr:passed` - Color: `0e8a16` (green)
   - `ai-cr:failed` - Color: `d73a4a` (red)  
   - `ai-cr:review` - Color: `1d76db` (blue)

### Option B: Create Labels via GitHub Actions

Create a one-time setup workflow to ensure labels exist:

```yaml
name: Setup Code Review Labels

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches:
      - main
    paths:
      - '.github/workflows/setup-labels.yml'

permissions:
  issues: write

jobs:
  create-labels:
    runs-on: ubuntu-latest
    steps:
      - name: Create or update labels
        uses: actions/github-script@v7
        with:
          script: |
            const labels = [
              {
                name: 'ai-cr:passed',
                color: '0e8a16',
                description: 'AI code review passed with no issues'
              },
              {
                name: 'ai-cr:failed',
                color: 'd73a4a',
                description: 'AI code review found issues'
              },
              {
                name: 'ai-cr:review',
                color: '1d76db',
                description: 'Trigger AI code review manually'
              }
            ];
            
            for (const label of labels) {
              try {
                // Try to create the label
                await github.rest.issues.createLabel({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  name: label.name,
                  color: label.color,
                  description: label.description
                });
                console.log(`Created label: ${label.name}`);
              } catch (error) {
                if (error.status === 422) {
                  // Label exists, update it
                  await github.rest.issues.updateLabel({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    name: label.name,
                    color: label.color,
                    description: label.description
                  });
                  console.log(`Updated label: ${label.name}`);
                } else {
                  console.error(`Error with label ${label.name}:`, error);
                }
              }
            }
```

### Color Reference

Common GitHub label colors:
- Green (success): `0e8a16`, `28a745`
- Red (error): `d73a4a`, `b60205`
- Blue (info): `0075ca`, `1d76db`
- Yellow (warning): `fbca04`, `fef2c0`
- Gray (neutral): `6a737d`, `e1e4e8`

## Complete Workflow Example

Here's a complete workflow that implements all the requirements:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches:
      - main

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    # Run on PR events, or when ai-cr:review label is added
    if: |
      github.event.action != 'labeled' || 
      github.event.label.name == 'ai-cr:review'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get PR details
        id: pr
        uses: actions/github-script@v7
        with:
          script: |
            const { data: pr } = await github.rest.pulls.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number
            });
            return {
              title: pr.title,
              body: pr.body || '',
              base: pr.base.sha,
              head: pr.head.sha
            };

      - name: Get diff
        id: diff
        run: |
          git diff ${{ fromJSON(steps.pr.outputs.result).base }}..${{ fromJSON(steps.pr.outputs.result).head }} > pr.diff
          echo "Generated diff file"

      - name: Run AI code review
        id: review
        run: |
          # Your review logic here
          # Set output: passed=true or passed=false
          echo "passed=true" >> $GITHUB_OUTPUT

      - name: Update labels
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.issue.number;
            const owner = context.repo.owner;
            const repo = context.repo.repo;
            const reviewPassed = ${{ steps.review.outputs.passed }} === true;
            
            // Define labels
            const AI_LABELS = ['ai-cr:passed', 'ai-cr:failed', 'ai-cr:review'];
            const newLabel = reviewPassed ? 'ai-cr:passed' : 'ai-cr:failed';
            
            // Get current labels
            const { data: labels } = await github.rest.issues.listLabelsOnIssue({
              issue_number: prNumber,
              owner,
              repo
            });
            
            // Remove all AI review labels
            for (const label of labels) {
              if (AI_LABELS.includes(label.name)) {
                await github.rest.issues.removeLabel({
                  issue_number: prNumber,
                  owner,
                  repo,
                  name: label.name
                }).catch(() => {});
              }
            }
            
            // Add result label
            await github.rest.issues.addLabels({
              issue_number: prNumber,
              owner,
              repo,
              labels: [newLabel]
            });
            
            console.log(`Review ${reviewPassed ? 'passed' : 'failed'}`);

      - name: Post review comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const reviewPassed = ${{ steps.review.outputs.passed }};
            const emoji = reviewPassed ? '✅' : '❌';
            const status = reviewPassed ? 'passed' : 'failed';
            
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `${emoji} AI Code Review ${status}\n\n<!-- review details here -->`
            });
```

## Key Points

1. **Permissions**: Always set `pull-requests: write` permission in the workflow
2. **Error Handling**: Use try-catch when removing labels (they might not exist)
3. **Label Existence**: Labels must exist in the repository before adding them to PRs
4. **Event Filtering**: Use `github.event.label.name` to filter specific label events
5. **Atomic Updates**: Remove old labels before adding new ones to avoid confusion
6. **Manual Setup**: Run the label creation workflow once before using the review workflow

## Recommended Approach

1. **Create labels manually** in the repository (one-time setup)
2. **Use a single workflow** that handles both automatic and manual reviews
3. **Clean up labels atomically** by removing all `ai-cr:*` labels before adding the result
4. **Remove the trigger label** (`ai-cr:review`) immediately after it triggers a manual review
5. **Use `if` conditions** at the job level to filter events efficiently
