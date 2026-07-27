/**
 * Unit tests for renderMarkdown and JSON extraction
 */
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./review.js";
import type { ReviewOutput } from "./review-schema.js";

describe("renderMarkdown", () => {
  it("renders a clean review with no findings", () => {
    const review: ReviewOutput = {
      overall_verdict: "PASS",
      summary: "This is a summary of the changes.",
      criteria: [
        { name: "Criterion 1", verdict: "PASS", findings: [] },
        { name: "Criterion 2", verdict: "PASS", findings: [] },
        { name: "Criterion 3", verdict: "PASS", findings: [] },
        { name: "Criterion 4", verdict: "PASS", findings: [] },
        { name: "Criterion 5", verdict: "PASS", findings: [] },
        { name: "Criterion 6", verdict: "PASS", findings: [] },
        { name: "Criterion 7", verdict: "PASS", findings: [] },
        { name: "Criterion 8", verdict: "PASS", findings: [] },
        { name: "Criterion 9", verdict: "PASS", findings: [] },
        { name: "Criterion 10", verdict: "PASS", findings: [] },
      ],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).toContain("### Summary");
    expect(markdown).toContain("This is a summary of the changes.");
    expect(markdown).toContain("### Findings");
    expect(markdown).toContain("✅ No findings");
    expect(markdown).not.toContain("## 🤖 AI Review"); // No top-level header
  });

  it("renders a review with findings", () => {
    const review: ReviewOutput = {
      overall_verdict: "FAIL",
      summary: "This change has issues.",
      criteria: [
        {
          name: "Code Quality",
          verdict: "FAIL",
          findings: [
            {
              severity: "BLOCKER",
              location: "src/utils.ts:42",
              issue: "Missing error handling for async operation",
              fix: "Add try/catch block around the fetch call",
            },
          ],
        },
        { name: "Criterion 2", verdict: "PASS", findings: [] },
        { name: "Criterion 3", verdict: "PASS", findings: [] },
        { name: "Criterion 4", verdict: "PASS", findings: [] },
        { name: "Criterion 5", verdict: "PASS", findings: [] },
        { name: "Criterion 6", verdict: "PASS", findings: [] },
        { name: "Criterion 7", verdict: "PASS", findings: [] },
        { name: "Criterion 8", verdict: "PASS", findings: [] },
        { name: "Criterion 9", verdict: "PASS", findings: [] },
        { name: "Criterion 10", verdict: "PASS", findings: [] },
      ],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).toContain("### Summary");
    expect(markdown).toContain("This change has issues.");
    expect(markdown).toContain("### Findings");
    expect(markdown).toContain("#### 🔴 Code Quality");
    expect(markdown).toContain("**🔴 BLOCKER**");
    expect(markdown).toContain("**Location:** `src/utils.ts:42`");
    expect(markdown).toContain("**Issue:** Missing error handling");
    expect(markdown).toContain("**Fix:** Add try/catch block");
    expect(markdown).not.toContain("✅ No findings");
  });

  it("renders multiple findings with different severities", () => {
    const review: ReviewOutput = {
      overall_verdict: "FAIL",
      summary: "Multiple issues found.",
      criteria: [
        {
          name: "Security",
          verdict: "FAIL",
          findings: [
            {
              severity: "BLOCKER",
              location: "src/api.ts:10",
              issue: "SQL injection vulnerability",
              fix: "Use parameterized queries",
            },
            {
              severity: "MAJOR",
              location: "src/api.ts:25",
              issue: "Missing input validation",
              fix: "Add zod schema",
            },
            {
              severity: "MINOR",
              location: "src/api.ts:30",
              issue: "Consider rate limiting",
              fix: "Add rate limiter middleware",
            },
            {
              severity: "NIT",
              location: "src/api.ts:5",
              issue: "Missing JSDoc comment",
              fix: "Add documentation",
            },
          ],
        },
        { name: "Criterion 2", verdict: "PASS", findings: [] },
        { name: "Criterion 3", verdict: "PASS", findings: [] },
        { name: "Criterion 4", verdict: "PASS", findings: [] },
        { name: "Criterion 5", verdict: "PASS", findings: [] },
        { name: "Criterion 6", verdict: "PASS", findings: [] },
        { name: "Criterion 7", verdict: "PASS", findings: [] },
        { name: "Criterion 8", verdict: "PASS", findings: [] },
        { name: "Criterion 9", verdict: "PASS", findings: [] },
        { name: "Criterion 10", verdict: "PASS", findings: [] },
      ],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).toContain("#### 🔴 Security");
    expect(markdown).toContain("**🔴 BLOCKER**");
    expect(markdown).toContain("**🟡 MAJOR**");
    expect(markdown).toContain("**🟢 MINOR**");
    expect(markdown).toContain("**⚪ NIT**");
  });

  it("renders questions section when present", () => {
    const review: ReviewOutput = {
      overall_verdict: "PASS",
      summary: "Changes look good but have questions.",
      criteria: Array.from({ length: 10 }, (_, i) => ({
        name: `Criterion ${i + 1}`,
        verdict: "PASS" as const,
        findings: [],
      })),
      questions: [
        "Why was the old approach removed?",
        "Is this change backward compatible?",
      ],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).toContain("### Questions");
    expect(markdown).toContain("- Why was the old approach removed?");
    expect(markdown).toContain("- Is this change backward compatible?");
  });

  it("does not render questions section when empty", () => {
    const review: ReviewOutput = {
      overall_verdict: "PASS",
      summary: "Clean changes.",
      criteria: Array.from({ length: 10 }, (_, i) => ({
        name: `Criterion ${i + 1}`,
        verdict: "PASS" as const,
        findings: [],
      })),
      questions: [],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).not.toContain("### Questions");
  });

  it("only renders criteria with findings", () => {
    const review: ReviewOutput = {
      overall_verdict: "FAIL",
      summary: "Some issues found.",
      criteria: [
        {
          name: "Criterion 1",
          verdict: "FAIL",
          findings: [
            {
              severity: "MAJOR",
              location: "file.ts:1",
              issue: "Issue 1",
              fix: "Fix 1",
            },
          ],
        },
        { name: "Criterion 2", verdict: "PASS", findings: [] },
        { name: "Criterion 3", verdict: "PASS", findings: [] },
        {
          name: "Criterion 4",
          verdict: "FAIL",
          findings: [
            {
              severity: "MAJOR",
              location: "file.ts:2",
              issue: "Issue 2",
              fix: "Fix 2",
            },
          ],
        },
        { name: "Criterion 5", verdict: "PASS", findings: [] },
        { name: "Criterion 6", verdict: "PASS", findings: [] },
        { name: "Criterion 7", verdict: "PASS", findings: [] },
        { name: "Criterion 8", verdict: "PASS", findings: [] },
        { name: "Criterion 9", verdict: "PASS", findings: [] },
        { name: "Criterion 10", verdict: "PASS", findings: [] },
      ],
    };

    const markdown = renderMarkdown(review);

    expect(markdown).toContain("#### 🔴 Criterion 1");
    expect(markdown).toContain("#### 🔴 Criterion 4");
    expect(markdown).not.toContain("Criterion 2");
    expect(markdown).not.toContain("Criterion 3");
  });
});

describe("JSON extraction patterns", () => {
  it("extracts JSON from code block", () => {
    const response = `Here's the review:

\`\`\`json
{
  "overall_verdict": "PASS",
  "summary": "Test",
  "criteria": []
}
\`\`\`

That's it.`;

    const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    expect(codeBlockMatch).not.toBeNull();
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      expect(parsed.overall_verdict).toBe("PASS");
    }
  });

  it("extracts JSON from response with preamble", () => {
    const response = `Let me analyze the changes.

{
  "overall_verdict": "PASS",
  "summary": "Test",
  "criteria": []
}`;

    const firstBrace = response.indexOf("{");
    const lastBrace = response.lastIndexOf("}");
    expect(firstBrace).toBeGreaterThan(0);
    expect(lastBrace).toBeGreaterThan(firstBrace);

    const jsonStr = response.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.overall_verdict).toBe("PASS");
  });

  it("handles JSON with trailing text", () => {
    const response = `{
  "overall_verdict": "PASS",
  "summary": "Test",
  "criteria": []
}

Hope this helps!`;

    const firstBrace = response.indexOf("{");
    const lastBrace = response.lastIndexOf("}");
    const jsonStr = response.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.overall_verdict).toBe("PASS");
  });

  it("detects missing braces", () => {
    const invalidResponse = "This is not JSON";

    const firstBrace = invalidResponse.indexOf("{");
    const lastBrace = invalidResponse.lastIndexOf("}");

    expect(firstBrace).toBe(-1);
    expect(lastBrace).toBe(-1);
  });

  it("extracts JSON from code block without language tag", () => {
    const response = `\`\`\`
{
  "overall_verdict": "FAIL",
  "summary": "Issues found",
  "criteria": []
}
\`\`\``;

    const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    expect(codeBlockMatch).not.toBeNull();
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      expect(parsed.overall_verdict).toBe("FAIL");
    }
  });
});
