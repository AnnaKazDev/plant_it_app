---
id: ai-code-review-config
created: 2026-07-27
updated: 2026-07-27
status: implementing
---

# AI Code Review Configuration Enhancement

Enhance the existing code-review agent workflow with structured output for 10xChampion certification:
- ✅ Composite action pattern for cleaner workflow structure
- ✅ 10 stack-specific criteria (Astro, Tailwind, Supabase, Cloudflare, Security, etc.)
- ✅ **Structured JSON output** with zod schema validation (Zadanie 2)
- ✅ Mechanical verdict: PASS/FAIL based on findings
- ✅ Severity markers (BLOCKER/MAJOR/MINOR/NIT) with issue counts
- ⏳ On-demand retry via `ai-cr:review` label trigger

**Key deliverables:**
1. **Zadanie 1**: 10 concrete criteria defined (Stack Conventions, Tailwind, Supabase, Cloudflare CPU, Security, Code Quality, Testing, Performance, Logic, Lessons)
2. **Zadanie 2**: Structured output with enforced JSON schema - enables mechanical pass/fail decisions in pipeline

**Scope note:** Promptfoo eval suite (Zadanie 3) is optional for this iteration.
