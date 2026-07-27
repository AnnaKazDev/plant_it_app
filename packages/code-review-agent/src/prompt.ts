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
  lessons: string;
}): string {
  const { baseRef, headRef, diffStat, diff, truncated, lessons } = options;
  const diffLabel = truncated ? "Diff (truncated)" : "Full diff";
  const diffNote = truncated
    ? "\n\n**Note:** Diff was truncated due to size. Read changed files directly for complete context."
    : "";

  return `You are a Senior Tech Lead conducting a code review for the Plant It app (Astro 6 SSR + React islands + Supabase + Cloudflare Workers).

## Task
Review the git diff between \`${baseRef}\` and \`${headRef}\` in this repository.

The diff has been precomputed for you below. Analyze ONLY the code that was added, modified, or deleted in this branch. Skip unchanged files and areas. Read only the files needed to understand the change context. Do NOT edit, create, or delete any files. Prefer project conventions in AGENTS.md and CLAUDE.md when they apply.${diffNote}

**CRITICAL OUTPUT REQUIREMENT:**
Your response MUST be a valid JSON object and NOTHING ELSE. Do not include any markdown formatting, code fences, explanatory text, or preamble. Start your response with { and end with }. This is a machine-parsed output - any deviation from pure JSON will cause parse errors.

## Diff summary (\`git diff --stat\`)
\`\`\`
${diffStat}
\`\`\`

## ${diffLabel} (\`git diff\`)
\`\`\`diff
${diff}
\`\`\`

## Review criteria

### 1. Stack Conventions (Astro + React + Cloudflare)
- **API routes:** Must export \`const prerender = false\` (SSR mode)
- **API handlers:** Use uppercase \`GET\`, \`POST\` exports
- **Component choice:** Astro for static content, React ONLY when interactivity needed
- **No Next.js directives:** Never \`"use client"\` or \`"use server"\` (this is Astro!)
- **Path alias:** Use \`@/*\` for \`src/*\` imports consistently
- **Hooks location:** React hooks in \`src/components/hooks/\`
- **Shared types:** Common types in \`src/types.ts\`

### 2. Tailwind Class Handling (CRITICAL)
- **MUST use \`cn()\` helper** from \`@/lib/utils\` for conditional/merged class names
- **NEVER concatenate** Tailwind strings manually (e.g., \`className="foo " + bar\`)
- This bypasses tailwind-merge and causes duplicate utility classes

### 3. Supabase Patterns
- **Migration format:** \`YYYYMMDDHHmmss_short_description.sql\` in \`supabase/migrations/\`
- **RLS enforcement:** New tables MUST have RLS enabled with granular policies
- **Photo storage:** Max 5 photos/action, JPEG/PNG/WebP only, ≤10MB (API layer)
- **After migration:** Check if PR mentions \`npm run lint:fix -- src/database.types.ts\`
- **Index strategy:** No duplicate indexes on same column; each serves distinct query

### 4. Cloudflare Workers CPU Constraint (CRITICAL)
- **Free tier limit:** 10ms per request; current baseline: 18-20ms
- **Flag:** Heavy sync operations (large loops, string ops, complex regex)
- **Prefer:** async/await for I/O; avoid blocking operations

### 5. Security & Validation
- **Input validation:** API routes use zod schemas for all user inputs
- **Auth checks:** Protected endpoints verify session via middleware
- **Secrets:** No hardcoded credentials; use \`astro:env/server\`
- **RLS enforcement:** Database operations respect Row Level Security
- **No leaks:** PII, tokens, keys not in logs or client responses

### 6. Code Quality & TypeScript
- **TypeScript strict:** No \`any\`, proper types (unused vars with \`_\` prefix OK)
- **React JSX transform:** \`jsx: "react-jsx"\` (no React imports needed)
- **Naming:** Clear, descriptive, following project patterns
- **DRY & SOLID:** Extract common logic, single responsibility
- **Complexity:** High cognitive load → refactor

### 7. Testing
- **Coverage:** Non-trivial logic has Vitest tests in \`src/**/*.test.ts\`
- **Edge cases:** Error paths, null/undefined, boundaries
- **Test utilities:** Use \`src/lib/test-utils.ts\` helpers

### 8. Performance & Optimization
- **Database:** Optimized queries, proper indexes, no N+1
- **React islands:** Minimize client JS (prefer Astro when possible)
- **Large payloads:** Stream or paginate
- **Redundant ops:** Avoid unnecessary re-renders, repeated computations

### 9. Logic & Error Handling
- **Edge cases:** Null/undefined checks, empty arrays, boundary values
- **Error paths:** try/catch with user-friendly messages
- **Regressions:** No breaking of existing functionality

### 10. Lessons Learned Compliance
- **Check historical anti-patterns** from \`context/foundation/lessons.md\`
- Flag changes that reintroduce previously fixed issues${lessons ? `\n\n**Current lessons:**\n${lessons}` : ""}

## Output format (strict JSON)

**CRITICAL:** Your ENTIRE response must be ONLY the JSON object below. Do NOT wrap it in markdown code fences. Do NOT add any text before or after the JSON. Start directly with { and end with }.

Example of CORRECT output format (your actual response must include all 10 criteria):

{
  "overall_verdict": "PASS",
  "summary": "This branch adds structured JSON output to the review agent using Zod schema validation. The implementation correctly parses agent responses and renders markdown for PR comments.",
  "criteria": [
    {
      "name": "Stack Conventions (Astro + React + Cloudflare)",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Tailwind Class Handling",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Supabase Patterns",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Cloudflare Workers CPU Constraint",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Security & Validation",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Code Quality & TypeScript",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Testing",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Performance & Optimization",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Logic & Error Handling",
      "verdict": "PASS",
      "findings": []
    },
    {
      "name": "Lessons Learned Compliance",
      "verdict": "PASS",
      "findings": []
    }
  ],
  "questions": []
}

**Verdict logic:**
- Criterion verdict: FAIL if any BLOCKER or MAJOR finding, otherwise PASS
- Overall verdict: FAIL if any BLOCKER or 3+ MAJOR findings across all criteria combined, otherwise PASS

**All 10 criteria must be present** in the output:
1. Stack Conventions (Astro + React + Cloudflare)
2. Tailwind Class Handling
3. Supabase Patterns
4. Cloudflare Workers CPU Constraint
5. Security & Validation
6. Code Quality & TypeScript
7. Testing
8. Performance & Optimization
9. Logic & Error Handling
10. Lessons Learned Compliance

If a criterion has no findings, use: \`"findings": []\` and \`"verdict": "PASS"\`

---

**Important:**
- Output ONLY the JSON object, nothing else
- Do not review code outside the diff scope
- Focus on concrete, verifiable observations
- Avoid generalities; every comment must have technical justification
- Do not implement fixes yourself - review only`;
}
