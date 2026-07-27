import { describe, expect, test } from "vitest";
import { parseReviewResponse } from "./review.js";
import { ReviewOutputSchema, computeOverallVerdict, computeCriterionVerdict, REQUIRED_CRITERIA } from "./review-schema.js";

describe("parseReviewResponse", () => {
  const validJson = {
    overall_verdict: "PASS",
    summary: "Test summary",
    criteria: [],
    questions: [],
  };

  test("parses plain JSON", () => {
    const response = JSON.stringify(validJson);
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("extracts JSON from markdown code block with json tag", () => {
    const response = "```json\n" + JSON.stringify(validJson) + "\n```";
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("extracts JSON from markdown code block without language tag", () => {
    const response = "```\n" + JSON.stringify(validJson) + "\n```";
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("handles preamble text before JSON", () => {
    const response = "Here is the review:\n\n" + JSON.stringify(validJson);
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("handles text after JSON", () => {
    const response = JSON.stringify(validJson) + "\n\nThat's all!";
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("handles both preamble and markdown code block", () => {
    const response = "Here is the review:\n```json\n" + JSON.stringify(validJson) + "\n```\nDone.";
    expect(parseReviewResponse(response)).toEqual(validJson);
  });

  test("handles nested JSON strings in fix property", () => {
    const jsonWithNestedString = {
      ...validJson,
      criteria: [
        {
          name: "Test",
          verdict: "FAIL",
          findings: [
            {
              severity: "MAJOR",
              location: "test.ts:1",
              issue: "Problem",
              fix: 'Use: const config = { "nested": "value" }',
            },
          ],
        },
      ],
    };
    const response = JSON.stringify(jsonWithNestedString);
    expect(parseReviewResponse(response)).toEqual(jsonWithNestedString);
  });

  test("handles code snippets with braces in fix field", () => {
    const jsonWithCodeSnippet = {
      ...validJson,
      criteria: [
        {
          name: "Test",
          verdict: "FAIL",
          findings: [
            {
              severity: "MAJOR",
              location: "test.ts:1",
              issue: "Problem",
              fix: 'return { ok: true };',
            },
          ],
        },
      ],
    };
    const response = 'Some preamble text\n' + JSON.stringify(jsonWithCodeSnippet);
    expect(parseReviewResponse(response)).toEqual(jsonWithCodeSnippet);
  });

  test("throws on response with no JSON object", () => {
    expect(() => parseReviewResponse("No JSON here!")).toThrow("No valid JSON object found");
  });

  test("throws on malformed JSON", () => {
    expect(() => parseReviewResponse("{ invalid json }")).toThrow();
  });

  test("throws on empty braces only", () => {
    expect(() => parseReviewResponse("{}")).not.toThrow(); // Empty object is valid JSON
    expect(parseReviewResponse("{}")).toEqual({});
  });

  test("handles whitespace variations", () => {
    const response = "\n\n  \n" + JSON.stringify(validJson) + "  \n\n";
    expect(parseReviewResponse(response)).toEqual(validJson);
  });
});

describe("Integration: parse → schema → verdict pipeline", () => {
  test("parses, validates schema, and recomputes verdicts correctly", () => {
    // Build a fixture with all 10 criteria in correct order
    const fullReviewFixture = {
      overall_verdict: "PASS", // Will be recomputed
      summary: "Integration test for full pipeline",
      criteria: REQUIRED_CRITERIA.map((name, index) => {
        if (index === 0) {
          // First criterion has 1 MAJOR finding (verdict should be FAIL)
          return {
            name,
            verdict: "PASS", // Intentionally wrong to test recomputation
            findings: [
              {
                severity: "MAJOR",
                location: "test.ts:1",
                issue: "Test issue",
                fix: "Test fix",
              },
            ],
          };
        }
        if (index === 1) {
          // Second criterion has 1 BLOCKER finding (verdict should be FAIL)
          return {
            name,
            verdict: "PASS", // Intentionally wrong to test recomputation
            findings: [
              {
                severity: "BLOCKER",
                location: "test.ts:2",
                issue: "Blocker issue",
                fix: "Blocker fix",
              },
            ],
          };
        }
        // Rest are clean
        return { name, verdict: "PASS", findings: [] };
      }),
      questions: ["Test question"],
    };

    const response = JSON.stringify(fullReviewFixture);

    // Step 1: Parse
    const parsed = parseReviewResponse(response);
    expect(parsed).toEqual(fullReviewFixture);

    // Step 2: Schema validation (should pass with correct criteria names)
    const validated = ReviewOutputSchema.parse(parsed);
    expect(validated.criteria).toHaveLength(10);
    expect(validated.criteria.map(c => c.name)).toEqual(REQUIRED_CRITERIA as unknown as string[]);

    // Step 3: Recompute criterion verdicts
    const recomputedCriteria = validated.criteria.map((criterion) => ({
      ...criterion,
      verdict: computeCriterionVerdict(criterion.findings),
    }));

    // Verify first two criteria are FAIL (had MAJOR/BLOCKER)
    expect(recomputedCriteria[0].verdict).toBe("FAIL");
    expect(recomputedCriteria[1].verdict).toBe("FAIL");
    // Verify rest are PASS
    for (let i = 2; i < recomputedCriteria.length; i++) {
      expect(recomputedCriteria[i].verdict).toBe("PASS");
    }

    // Step 4: Recompute overall verdict
    const recomputedOverall = computeOverallVerdict(recomputedCriteria);
    
    // Should be FAIL because 1 BLOCKER (even though only 1 MAJOR)
    expect(recomputedOverall).toBe("FAIL");
  });

  test("fails schema validation with wrong criterion names", () => {
    const invalidCriteria = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: Array.from({ length: 10 }, (_, i) => ({
        name: `Wrong Criterion ${i + 1}`,
        verdict: "PASS",
        findings: [],
      })),
      questions: [],
    };

    const response = JSON.stringify(invalidCriteria);
    const parsed = parseReviewResponse(response);

    // Should fail schema validation due to wrong criterion names
    expect(() => ReviewOutputSchema.parse(parsed)).toThrow();
  });

  test("fails schema validation with wrong criterion count", () => {
    const invalidCount = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: REQUIRED_CRITERIA.slice(0, 5).map(name => ({
        name,
        verdict: "PASS",
        findings: [],
      })),
      questions: [],
    };

    const response = JSON.stringify(invalidCount);
    const parsed = parseReviewResponse(response);

    // Should fail schema validation due to wrong count (5 instead of 10)
    expect(() => ReviewOutputSchema.parse(parsed)).toThrow();
  });
});
