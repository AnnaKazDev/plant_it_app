---
id: ai-code-review-config
created: 2026-07-27
updated: 2026-07-27
status: implementing
---

# AI Code Review Configuration Enhancement

Enhance the existing code-review agent workflow:
- ✅ Composite action pattern for cleaner workflow structure
- ✅ 10 stack-specific criteria (expanded from 5 generic)
- ✅ Severity markers (BLOCKER/MAJOR/MINOR/NIT) with issue counts
- ⏳ On-demand retry via `ai-cr:review` label trigger

**Scope note:** Originally planned scoring system (1-10 scale) and pass/fail labels were removed - severity markers and human judgment are sufficient for advisory review.
