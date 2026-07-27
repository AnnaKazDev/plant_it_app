/**
 * Builds the one-shot review prompt with precomputed diff.
 * Agent runs against the repo root (local cwd) and must not edit files.
 */
export function buildReviewPrompt(options: {
  baseRef: string;
  headRef: string;
  diffStat: string;
  diff: string;
  truncated: boolean;
}): string {
  const { baseRef, headRef, diffStat, diff, truncated } = options;
  const diffLabel = truncated ? "Diff (truncated)" : "Full diff";
  const diffNote = truncated
    ? "\n\n**Note:** Diff was truncated due to size. Read changed files directly for complete context."
    : "";

  return `You are a Senior Tech Lead conducting a code review for the Plant It app (Astro 6 SSR + React islands + Supabase + Cloudflare Workers).

## Task
Review the git diff between \`${baseRef}\` and \`${headRef}\` in this repository.

The diff has been precomputed for you below. Analyze ONLY the code that was added, modified, or deleted in this branch. Skip unchanged files and areas. Read only the files needed to understand the change context. Do NOT edit, create, or delete any files. Prefer project conventions in AGENTS.md and CLAUDE.md when they apply.${diffNote}

## Diff summary (\`git diff --stat\`)
\`\`\`
${diffStat}
\`\`\`

## ${diffLabel} (\`git diff\`)
\`\`\`diff
${diff}
\`\`\`

## Review criteria

### 1. Logic and bugs
- Does the change introduce risk of errors, regressions, or unhandled edge cases?
- Are error paths properly handled?
- Are null/undefined cases covered?

### 2. Security
- Are inputs properly validated (especially API routes - zod schemas)?
- Is there risk of sensitive data leakage (secrets, tokens, PII)?
- Are auth checks present where needed?
- Are RLS policies correctly enforced (Supabase)?

### 3. Performance
- Are there expensive operations (N+1 queries, unnecessary loops, redundant renders)?
- Are database queries optimized (indexes, proper joins)?
- Are large payloads handled efficiently?

### 4. Code quality
- Is the code consistent, readable, and follows SOLID/DRY principles?
- Are naming and responsibility separation clear?
- Does it follow project conventions (API routes: \`prerender = false\`, uppercase handlers)?
- Is TypeScript used strictly (no \`any\`, proper types)?

### 5. Testing
- Are there tests for non-trivial behavior?
- Are edge cases covered in tests?

## Output format (strict markdown)

### Summary
Describe the goal and scope of changes in 2–4 sentences.

### Findings
For each issue, use this exact format:

**🔴 BLOCKER** | **🟡 MAJOR** | **🟢 MINOR** | **⚪ NIT**

**Location:** \`path/to/file.ts:line\`

**Issue:** Explain why this is a problem and what impact it may have.

**Fix:** Provide a ready-to-use code snippet with the correction.

\`\`\`typescript
// concrete fix here
\`\`\`

---

If there are NO issues, write exactly: "✅ No findings. Code looks good."

### Questions
Optional clarifying questions for the author. Omit section if none.

---

**Important:**
- Do not review code outside the diff scope
- Focus on concrete, verifiable observations
- Avoid generalities; every comment must have technical justification
- Do not implement fixes yourself - review only`;
}
