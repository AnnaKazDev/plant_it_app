import { describe, it, expect } from "vitest";
import {
  countFindingSeverities,
  evaluatePolicyPass,
  formatGateStatusText,
  gateResultFromPolicyViolation,
  type FindingCounts,
} from "./gate-policy.js";
import type { CriterionReview } from "./review-schema.js";

function counts(overrides: Partial<FindingCounts> = {}): FindingCounts {
  return {
    blockerCount: 0,
    majorCount: 0,
    minorCount: 0,
    nitCount: 0,
    ...overrides,
  };
}

function criterionWithFindings(
  name: string,
  severities: Array<"BLOCKER" | "MAJOR" | "MINOR" | "NIT">,
): CriterionReview {
  return {
    name,
    verdict: "PASS",
    findings: severities.map((severity, index) => ({
      severity,
      location: `src/file.ts:${index + 1}`,
      issue: "issue",
      fix: "fix",
    })),
  };
}

describe("evaluatePolicyPass", () => {
  it("default: passes with 2 major findings", () => {
    expect(evaluatePolicyPass("default", counts({ majorCount: 2 }))).toBe(true);
  });

  it("default: fails with 3 major findings", () => {
    expect(evaluatePolicyPass("default", counts({ majorCount: 3 }))).toBe(false);
  });

  it("default: fails with any blocker", () => {
    expect(evaluatePolicyPass("default", counts({ blockerCount: 1 }))).toBe(false);
  });

  it("blocker-only: passes with major findings", () => {
    expect(evaluatePolicyPass("blocker-only", counts({ majorCount: 5 }))).toBe(true);
  });

  it("strict: fails with 1 major", () => {
    expect(evaluatePolicyPass("strict", counts({ majorCount: 1 }))).toBe(false);
  });
});

describe("countFindingSeverities", () => {
  it("aggregates severities across criteria", () => {
    const criteria = [
      criterionWithFindings("A", ["BLOCKER", "MINOR"]),
      criterionWithFindings("B", ["MAJOR", "NIT"]),
    ];

    expect(countFindingSeverities(criteria)).toEqual({
      blockerCount: 1,
      majorCount: 1,
      minorCount: 1,
      nitCount: 1,
    });
  });
});

describe("formatGateStatusText", () => {
  it("shows advisory would-block wording", () => {
    const result = gateResultFromPolicyViolation("default", "advisory", counts({ majorCount: 3 }));
    expect(formatGateStatusText(result)).toContain("Would block");
    expect(formatGateStatusText(result)).toContain("mode: advisory");
  });
});
