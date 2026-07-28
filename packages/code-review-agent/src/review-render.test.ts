/**
 * Unit tests for renderMarkdown and JSON extraction
 */
import { describe, it, expect } from "vitest";
import { renderMarkdown, parseReviewResponse } from "./review.js";
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
    expect(markdown).toContain("#### ⭐ CODE QUALITY");
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

    expect(markdown).toContain("#### ⭐ SECURITY");
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

    expect(markdown).toContain("#### ⭐ CRITERION 1");
    expect(markdown).toContain("#### ⭐ CRITERION 4");
    expect(markdown).not.toContain("Criterion 2");
    expect(markdown).not.toContain("Criterion 3");
  });
});

describe("JSON extraction via parseReviewResponse", () => {
  // Note: Detailed parseReviewResponse tests live in review.test.ts
  // These tests verify the same patterns work through the actual parser
  
  it("extracts JSON from code block via parseReviewResponse", () => {
    const validJson = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: [],
    };
    const response = `Here's the review:

\`\`\`json
${JSON.stringify(validJson)}
\`\`\`

That's it.`;

    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  it("extracts JSON from response with preamble via parseReviewResponse", () => {
    const validJson = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: [],
    };
    const response = `Let me analyze the changes.

${JSON.stringify(validJson)}`;

    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  it("handles JSON with trailing text via parseReviewResponse", () => {
    const validJson = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: [],
    };
    const response = `${JSON.stringify(validJson)}

Hope this helps!`;

    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  it("detects missing braces via parseReviewResponse", () => {
    const invalidResponse = "This is not JSON";
    expect(() => parseReviewResponse(invalidResponse)).toThrow("No valid JSON object found");
  });

  it("extracts JSON from code block without language tag via parseReviewResponse", () => {
    const validJson = {
      overall_verdict: "FAIL",
      summary: "Issues found",
      criteria: [],
    };
    const response = `\`\`\`
${JSON.stringify(validJson)}
\`\`\``;

    expect(parseReviewResponse(response)).toEqual(validJson);
  });
});
