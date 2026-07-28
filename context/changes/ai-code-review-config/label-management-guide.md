# GitHub Actions PR Label Management Guide

This guide documents label handling for the **shipped** AI code review workflow (`.github/workflows/ai-review.yml`).

## Active behavior

The workflow uses one label:

- `ai-cr:review` — manual trigger for on-demand reviews

**Verdict is comment-only.** Automatic `ai-cr:passed` / `ai-cr:failed` labels were removed. Pass/fail is shown in the PR comment from structured JSON + rendered markdown.

## Trigger on label addition

The workflow listens for `labeled` events and runs when `ai-cr:review` is added:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches: [main]

jobs:
  ai-code-review:
    if: |
      github.event.action != 'labeled' ||
      github.event.label.name == 'ai-cr:review'
```

After a manual run, the workflow removes `ai-cr:review` so it does not linger on the PR.

## One-time label setup

Create the trigger label in the repository (Issues → Labels):

| Label           | Color   | Description                          |
|----------------|---------|--------------------------------------|
| `ai-cr:review` | `1d76db` | Trigger AI code review manually |

No other `ai-cr:*` labels are required by the current workflow.

## Remove the trigger label after use

Implemented in `ai-review.yml`:

```yaml
- name: Remove retry label
  if: always() && github.event.action == 'labeled' && github.event.label.name == 'ai-cr:review'
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
        if (e.status !== 404) throw e;
      }
```

## Permissions

The workflow needs:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Deprecated: automatic pass/fail labels

Earlier designs added `ai-cr:passed` and `ai-cr:failed` based on review output. That was **removed** in favor of advisory PR comments. Do not add pass/fail label steps unless you intentionally extend the workflow beyond the shipped configuration.
