---
id: ai-code-review-config
created: 2026-07-27
updated: 2026-07-27
status: complete
---

# AI Code Review Configuration Enhancement

Enhance the existing code-review agent workflow with structured output for 10xChampion certification:
- ✅ Composite action pattern for cleaner workflow structure
- ✅ 10 stack-specific criteria (Astro, Tailwind, Supabase, Cloudflare, Security, etc.)
- ✅ **Structured JSON output** with zod schema validation (Zadanie 2)
- ✅ Mechanical verdict: PASS/FAIL based on findings
- ✅ Severity markers (BLOCKER/MAJOR/MINOR/NIT) with issue counts
- ✅ On-demand retry via `ai-cr:review` label trigger
- ✅ **Code quality fixes** based on AI code review feedback

**Key deliverables:**
1. **Zadanie 1**: 10 concrete criteria defined (Stack Conventions, Tailwind, Supabase, Cloudflare CPU, Security, Code Quality, Testing, Performance, Logic, Lessons)
2. **Zadanie 2**: Structured output with enforced JSON schema - enables mechanical pass/fail decisions in pipeline

**Scope note:** Promptfoo eval suite (Zadanie 3) is optional for this iteration.

**Design decisions:**
- **Pivot from 1-10 scoring to PASS/FAIL**: Intentional simplification for 10xChampion certification. Severity markers (BLOCKER/MAJOR/MINOR/NIT) provide sufficient granularity without arbitrary numeric thresholds.
- **Advisory review (comment-only, no blocking)**: Failing verdict shows ❌ in PR comment but does NOT block merge. Human makes final decision. This remains comment-only indefinitely.
- **No automatic labels**: Originally planned `ai-cr:passed`/`ai-cr:failed` labels removed. Structured JSON + verdict in PR comment is sufficient.

## Code Quality Improvements (2026-07-27)

Fixed critical and major issues identified by AI code review:

### Fixed Issues

1. **✅ Schema enforcement** - `ReviewOutputSchema` now requires exactly 10 criteria via `.length(10)` constraint
2. **✅ Mechanical verdict computation** - Added `computeCriterionVerdict()` and `computeOverallVerdict()` functions that enforce documented rules in TypeScript:
   - Criterion FAIL: any BLOCKER or MAJOR finding
   - Overall FAIL: any BLOCKER or 3+ MAJOR findings
   - LLM verdicts are now computed and replaced, with mismatch warnings logged
3. **✅ Workflow exit code handling** - Workflow now checks `exitCode` first before trusting JSON verdict. Non-zero exit codes force failed status regardless of JSON content.
4. **✅ JSON validation in workflow** - PR comment formatting delegated to `format-pr-comment.ts` (shared schema + verdict logic)
5. **✅ Duplicate header fix** - Removed top-level header from `renderMarkdown()` since workflow already adds it
6. **✅ Dead code removal** - Deleted `formatter.ts` (no longer used after JSON refactor)
7. **✅ Test coverage** - Added comprehensive Vitest tests:
   - `review-schema.test.ts` - Schema validation, normalization, and verdict computation
   - `review-render.test.ts` - Markdown rendering and JSON extraction
   - `format-pr-comment.test.ts` - PR comment formatting and validation exit-code handling
   - All 66 Vitest tests passing

### Technical Details

- Fixed CLI pattern in `review.ts` to prevent `process.exit()` on import (test compatibility)
- Exported `renderMarkdown()` for testing
- Added vitest config and test scripts to `packages/code-review-agent/package.json`
