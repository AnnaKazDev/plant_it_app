import { describe, expect, test } from "vitest";
import { parseReviewResponse } from "./review.js";

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
