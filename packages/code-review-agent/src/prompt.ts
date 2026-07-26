/**
 * Builds the one-shot review prompt with precomputed diff.
 * Agent runs against the repo root (local cwd) and must not edit files.
 */
export function buildReviewPrompt(options: {
  baseRef: string;
  headRef: string;
  diffStat: string;
  diff: string;
}): string {
  const { baseRef, headRef, diffStat, diff } = options;

  return `You are a code review agent for the Plant It app (Astro 6 SSR + React islands + Supabase + Cloudflare Workers).

## Task
Review the git diff between \`${baseRef}\` and \`${headRef}\` in this repository.

The diff has been precomputed for you below. Read only the files needed to understand the change context. Do NOT edit, create, or delete any files. Prefer project conventions in AGENTS.md and CLAUDE.md when they apply.

## Diff summary (\`git diff --stat\`)
\`\`\`
${diffStat}
\`\`\`

## Full diff (\`git diff\`)
\`\`\`diff
${diff}
\`\`\`

## Focus
- Bugs and correctness risks
- Security / auth / secrets / RLS mistakes
- API route conventions (\`prerender = false\`, zod validation, uppercase handlers)
- TypeScript strictness and clear failure modes
- Missing tests for non-trivial behavior

## Output format (markdown)
### Summary
1–3 sentences.

### Findings
For each issue:
- **Severity:** blocker | major | minor | nit
- **File:** path (and line if clear)
- **Issue:** what is wrong
- **Suggestion:** concrete fix

If there are no issues, write: "No findings."

### Questions
Optional clarifying questions for the author. Omit if none.

Do not implement fixes. Review only.`;
}
