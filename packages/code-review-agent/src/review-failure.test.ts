import { describe, it, expect } from "vitest";
import {
  extractUsefulLogContent,
  formatFailureReport,
  stripNpmNoise,
} from "./review-failure.js";

describe("formatFailureReport", () => {
  it("includes reason and raw response", () => {
    const report = formatFailureReport({
      reason: "No valid JSON object found",
      rawResponse: '{"summary":"test"}',
    });

    expect(report).toContain("### Review agent error");
    expect(report).toContain("**Reason:** No valid JSON object found");
    expect(report).toContain('{"summary":"test"}');
  });
});

describe("stripNpmNoise", () => {
  it("removes npm lifecycle lines", () => {
    const input = `> @plant-it/code-review-agent@0.1.0 review
> tsx src/review.ts

### Review agent error

**Reason:** parse failed`;

    expect(stripNpmNoise(input)).toBe(`### Review agent error

**Reason:** parse failed`);
  });
});

describe("extractUsefulLogContent", () => {
  it("prefers failure report over npm noise", () => {
    const result = extractUsefulLogContent(
      "> tsx src/review.ts",
      "### Review agent error\n\n**Reason:** parse failed",
    );

    expect(result).toContain("parse failed");
    expect(result).not.toContain("tsx src/review.ts");
  });
});
