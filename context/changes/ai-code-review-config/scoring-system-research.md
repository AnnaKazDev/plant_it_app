# Scoring System Research & Proposal

**Status:** Research complete  
**Date:** 2026-07-27  
**Purpose:** Design a 10-criteria scoring system (1-10 scale) for the code review agent

## Executive Summary

After researching code review scoring patterns and analyzing the current prompt structure, I propose a **dual-mode output format**: a scoring summary section at the top, followed by traditional detailed findings. This preserves the valuable file:line specificity while adding quantitative metrics for CI/CD automation.

---

## Research Findings

### Industry Patterns

Common approaches for code review scoring systems (from web research):

1. **Weighted deduction model**: `Score = 10 - SUM(Deductions × Weights × Severity Multipliers)`
2. **Category-based**: 5-10 categories with individual scores, then averaged or weighted
3. **Severity mapping**: Critical (2.0x), Major (1.5x), Minor (1.0x), Nitpick (0.5x)
4. **Pass/fail thresholds**: 
   - 9-10: Excellent (production-ready)
   - 7-8: Good (minor fixes)
   - 5-6: Adequate (needs work)
   - 3-4: Poor (significant issues)
   - 0-2: Critical (do not merge)

### Current State Analysis

**Current prompt structure** (`packages/code-review-agent/src/prompt.ts`):
- 10 criteria defined with detailed guidelines (lines 36-96)
- Output format uses severity markers: 🔴 BLOCKER, 🟡 MAJOR, 🟢 MINOR, ⚪ NIT (lines 98-131)
- Each finding has: severity, location (`path/to/file:line`), issue explanation, fix snippet
- Lessons.md integration for historical anti-patterns

**Current formatter** (`packages/code-review-agent/src/formatter.ts`):
- Handles severity markers with colors (red/yellow/green/gray)
- Creates clickable file links (OSC 8 escape codes for VS Code)
- Formats sections (###), location lines, issue/fix headers
- Line-by-line streaming with buffering

**Current requirements** (`requirements.md`):
- Each criterion scored 1-10 (1=worst, 10=best)
- 10 criteria match the prompt's review criteria sections
- PR labels: `ai-cr:passed` (green) OR `ai-cr:failed` (red)

---

## Proposal: Dual-Mode Output Format

### 1. Prompt Structure Changes

Add a new section **after the review criteria** but **before the output format**:

```markdown
## Scoring methodology

For each of the 10 review criteria above, assign a score from 1 to 10:

- **10**: Excellent, no issues, exemplary code
- **9**: Very good, trivial nitpicks only
- **7-8**: Good, minor improvements needed
- **5-6**: Adequate, clear problems but not critical
- **3-4**: Poor, significant issues requiring fixes
- **1-2**: Critical, major problems, do not merge

**Scoring algorithm:**
1. Start each criterion at 10
2. Deduct points based on finding severity in that category:
   - 🔴 BLOCKER: -3 points per issue
   - 🟡 MAJOR: -2 points per issue
   - 🟢 MINOR: -1 point per issue
   - ⚪ NIT: -0.5 points per issue
3. Floor at 1 (minimum score)
4. Round to nearest integer (0.5 rounds up)

**Overall score:** Average of all 10 criterion scores (rounded to 1 decimal place)

**Pass/fail threshold:** Overall score ≥ 7.0 = PASS, < 7.0 = FAIL
```

### 2. Output Format Structure

**Proposed markdown template:**

```markdown
## Code Review Score: X.X/10 — ✅ PASS | ❌ FAIL

### Score Breakdown

| Criterion | Score | Grade | Issues |
|:----------|------:|:-----:|:-------|
| 1. Stack Conventions | X/10 | {emoji} | X blocker, X major, X minor, X nit |
| 2. Tailwind | X/10 | {emoji} | X blocker, X major, X minor, X nit |
| 3. Supabase | X/10 | {emoji} | ... |
| 4. Cloudflare CPU | X/10 | {emoji} | ... |
| 5. Security | X/10 | {emoji} | ... |
| 6. Code Quality | X/10 | {emoji} | ... |
| 7. Testing | X/10 | {emoji} | ... |
| 8. Performance | X/10 | {emoji} | ... |
| 9. Logic/Errors | X/10 | {emoji} | ... |
| 10. Lessons Learned | X/10 | {emoji} | ... |
| **Overall** | **X.X/10** | {emoji} | **X total findings** |

**Grade emoji key:**
- 🟢 9-10: Excellent
- 🟡 7-8: Good
- 🟠 5-6: Adequate
- 🔴 3-4: Poor
- ⛔ 1-2: Critical

---

### Summary
{2-4 sentences describing the goal and scope of changes}

---

### Findings

{Keep existing detailed format with file:line references, grouped by criterion}

#### 1. Stack Conventions

**🔴 BLOCKER**

**Location:** `path/to/file.ts:line`

**Issue:** {explanation}

**Fix:** {concrete code snippet}

```typescript
// fix here
```

---

{repeat for other criteria...}

---

### Questions
{Optional clarifying questions for the author. Omit section if none.}
```

### 3. Criterion-to-Finding Mapping

Each finding must be tagged with its criterion number in the prompt instructions:

```markdown
**Output format requirements:**

1. Start with the scoring table (mandatory)
2. Group all findings by criterion (1-10)
3. Within each criterion group, list findings from highest to lowest severity
4. Use the exact severity markers: 🔴 BLOCKER, 🟡 MAJOR, 🟢 MINOR, ⚪ NIT
5. If a criterion has NO issues, show it as "10/10 🟢" in the table with "0 findings"
6. If there are NO findings across all criteria, write exactly: "✅ No findings. Code looks good."
```

### 4. Scoring Algorithm (Pseudo-code)

```typescript
interface Finding {
  criterion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  severity: "BLOCKER" | "MAJOR" | "MINOR" | "NIT";
  location: string;
  issue: string;
  fix: string;
}

function calculateCriterionScore(findings: Finding[], criterion: number): number {
  let score = 10;
  
  for (const finding of findings.filter(f => f.criterion === criterion)) {
    switch (finding.severity) {
      case "BLOCKER":
        score -= 3;
        break;
      case "MAJOR":
        score -= 2;
        break;
      case "MINOR":
        score -= 1;
        break;
      case "NIT":
        score -= 0.5;
        break;
    }
  }
  
  return Math.max(1, Math.round(score)); // floor at 1, round to integer
}

function calculateOverallScore(criterionScores: number[]): number {
  const average = criterionScores.reduce((sum, s) => sum + s, 0) / criterionScores.length;
  return Math.round(average * 10) / 10; // round to 1 decimal place
}

function determinePassFail(overallScore: number): "PASS" | "FAIL" {
  return overallScore >= 7.0 ? "PASS" : "FAIL";
}
```

### 5. Severity-to-Score Mapping Rationale

| Severity | Deduction | Reasoning |
|:---------|----------:|:----------|
| 🔴 BLOCKER | -3 points | Security holes, data loss, broken functionality — ~3 blockers fail a criterion |
| 🟡 MAJOR | -2 points | Significant bugs, missing tests, poor patterns — ~5 major issues fail a criterion |
| 🟢 MINOR | -1 point | Code smells, style issues, inefficiencies — ~10 minor issues fail a criterion |
| ⚪ NIT | -0.5 points | Preferences, optional polish — ~20 nits fail a criterion |

This deduction scale ensures:
- A single blocker drops a criterion from 10 to 7 (still passing, but flagged)
- Two blockers = score 4 (poor, needs attention)
- Three blockers = score 1 (critical)
- Minor issues accumulate slowly (allows for nitpicky reviews without failing)

### 6. Pass/Fail Threshold

**Proposal: Overall score ≥ 7.0 = PASS**

Rationale:
- Aligns with industry "Good" threshold (7-8 range)
- Allows for minor issues while blocking critical problems
- One criterion at 4/10 can pull overall below 7.0 (if others are 10/10, average = 9.4 — safe)
- Two criteria at 4/10 = overall 8.8 (still passing)
- Three criteria at 4/10 = overall 8.2 (still passing)
- One criterion at 1/10 + one at 4/10 = overall 8.5 (still passing if others are 10)
- Two criteria at 1/10 = overall 8.2 (marginally passing — may want to review)

**Alternative thresholds to consider:**
- **7.5**: Stricter, fails more borderline PRs
- **6.5**: More lenient, allows more issues through
- **8.0**: Very strict, only excellent code passes

### 7. Comment Statistics Change

**Current approach (implied):** Count findings by severity (blocker/major/minor/nit)

**Proposed approach:** Add scoring metadata to PR comment

**GitHub comment format:**

```markdown
## Code Review: X.X/10 — ✅ PASS

**Overall:** X.X/10 (Threshold: ≥ 7.0)

**Breakdown:**
- 🟢 Stack Conventions: 9/10
- 🟢 Tailwind: 10/10
- 🟡 Supabase: 7/10
- 🟢 Cloudflare CPU: 10/10
- 🔴 Security: 4/10
- 🟡 Code Quality: 8/10
- 🟢 Testing: 9/10
- 🟢 Performance: 10/10
- 🟢 Logic/Errors: 9/10
- 🟢 Lessons Learned: 10/10

**Findings:** 12 total (2 blocker, 3 major, 5 minor, 2 nit)

**Critical areas:** Security (4/10) — 2 blockers found

<details>
<summary>View detailed review output</summary>

{paste full agent output here}

</details>
```

**Labeling strategy:**
- `ai-cr:passed` — overall score ≥ 7.0
- `ai-cr:failed` — overall score < 7.0

Optional additional labels:
- `ai-cr:excellent` — overall score ≥ 9.0
- `ai-cr:critical` — any criterion ≤ 2

---

## Implementation Checklist

### Phase 1: Prompt Changes
- [ ] Add scoring methodology section to `buildReviewPrompt()` in `prompt.ts`
- [ ] Update output format section with new scoring table template
- [ ] Add criterion-to-finding mapping instructions
- [ ] Specify scoring algorithm in natural language for the agent

### Phase 2: Formatter Updates (Optional)
- [ ] Add table formatting support in `formatter.ts` (currently no table detection)
- [ ] Add grade emoji formatting (🟢/🟡/🟠/🔴/⛔)
- [ ] Enhance section header detection for "Score Breakdown"

### Phase 3: Testing
- [ ] Test with clean PR (expect 10/10 on all criteria)
- [ ] Test with PR containing 1 blocker in Stack Conventions (expect 7/10 for that criterion)
- [ ] Test with PR containing multiple issues across criteria
- [ ] Test edge case: exactly 7.0 overall score (should pass)
- [ ] Test edge case: 6.9 overall score (should fail)

### Phase 4: CI/CD Integration
- [ ] Update `.github/workflows/review.yml` to parse scoring table
- [ ] Add label logic based on overall score (≥ 7.0 = passed, < 7.0 = failed)
- [ ] Update PR comment template with scoring summary
- [ ] Add optional labels for excellent (≥ 9.0) and critical (any ≤ 2)

---

## Open Questions

1. **Should the overall threshold be configurable?** (env var `REVIEW_PASS_THRESHOLD=7.0`)
2. **Should individual criterion thresholds exist?** (e.g., Security must be ≥ 8.0)
3. **Should we weight criteria differently?** (e.g., Security 1.5x, Tailwind 0.5x)
4. **Should NIT findings contribute to scores at all?** (alternative: 0 point deduction)
5. **Should the agent explain score deductions?** (e.g., "Stack Conventions: 7/10 — Deducted 3 points for 1 blocker (missing prerender)")

---

## Alternatives Considered

### Alternative 1: Weighted Criteria
Instead of simple average, weight criteria by importance:

```typescript
const weights = {
  stackConventions: 0.10,   // 10%
  tailwind: 0.05,           // 5%
  supabase: 0.10,           // 10%
  cloudflareCPU: 0.10,      // 10%
  security: 0.15,           // 15% (highest)
  codeQuality: 0.12,        // 12%
  testing: 0.12,            // 12%
  performance: 0.10,        // 10%
  logicErrors: 0.13,        // 13%
  lessonsLearned: 0.03,     // 3%
};

const overallScore = Object.entries(weights)
  .reduce((sum, [key, weight]) => sum + (criterionScores[key] * weight), 0);
```

**Pros:** Emphasizes critical areas (security, logic)  
**Cons:** More complex, harder to explain, arbitrary weight choices

**Recommendation:** Start with simple average, add weights later if needed

### Alternative 2: Binary Pass/Fail Per Criterion
Each criterion has a pass threshold (e.g., ≥ 7), overall pass requires ALL criteria to pass.

**Pros:** Ensures no critical area is ignored  
**Cons:** Too strict, one bad criterion fails entire PR

**Recommendation:** Keep overall average approach, optionally add "blocker criterion" logic (any ≤ 2 = auto-fail)

### Alternative 3: No Scoring, Just Severity Counts
Keep existing format, add summary: "2 blockers, 3 major, 5 minor, 2 nit"

**Pros:** Simpler to implement  
**Cons:** Doesn't meet requirements.md (1-10 scale per criterion)

**Recommendation:** Do NOT pursue — requirements are clear

---

## Recommendations

1. **Implement the dual-mode output format** (scoring table + detailed findings)
2. **Use simple average for overall score** (no weighting, at least for v1)
3. **Set pass threshold at 7.0** (industry standard "Good" tier)
4. **Keep severity markers in detailed findings** (don't change existing format)
5. **Add criterion tagging in prompt** (explicitly tell agent which criterion each finding belongs to)
6. **Test thoroughly with real PRs** before enabling in CI
7. **Consider optional config later** (threshold, weights, per-criterion floors)

---

## Next Steps

1. **Review this proposal** with team/stakeholders
2. **Decide on open questions** (especially threshold, weighting, nitpick scoring)
3. **Update prompt.ts** with scoring methodology
4. **Update requirements.md** with approved scoring algorithm
5. **Test locally** with 3-5 example PRs (clean, minor issues, major issues)
6. **Implement CI parsing** (score extraction + labeling)
7. **Document in README.md** (scoring system, pass/fail criteria)
