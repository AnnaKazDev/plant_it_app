/**
 * Unit tests for review schema validation and verdict computation
 */
import { describe, it, expect } from "vitest";
import {
  ReviewOutputSchema,
  computeCriterionVerdict,
  computeOverallVerdict,
  REQUIRED_CRITERIA,
  type Finding,
  type CriterionReview,
} from "./review-schema.js";

describe("ReviewOutputSchema", () => {
  it("validates a correct review with exactly 10 criteria", () => {
    const validReview = {
      overall_verdict: "PASS",
      summary: "This change adds a new feature without breaking existing functionality.",
      criteria: REQUIRED_CRITERIA.map(name => ({
        name,
        verdict: "PASS" as const,
        findings: [],
      })),
    };

    expect(() => ReviewOutputSchema.parse(validReview)).not.toThrow();
  });

  it("rejects review with less than 10 criteria", () => {
    const invalidReview = {
      overall_verdict: "PASS",
      summary: "Short summary",
      criteria: [
        { name: "Criterion 1", verdict: "PASS", findings: [] },
        { name: "Criterion 2", verdict: "PASS", findings: [] },
      ],
    };

    expect(() => ReviewOutputSchema.parse(invalidReview)).toThrow();
  });

  it("rejects review with more than 10 criteria", () => {
    const invalidReview = {
      overall_verdict: "PASS",
      summary: "Short summary",
      criteria: Array.from({ length: 11 }, (_, i) => ({
        name: `Criterion ${i + 1}`,
        verdict: "PASS",
        findings: [],
      })),
    };

    expect(() => ReviewOutputSchema.parse(invalidReview)).toThrow();
  });

  it("validates review with findings", () => {
    const reviewWithFindings = {
      overall_verdict: "FAIL" as const,
      summary: "This change has issues that need to be addressed.",
      criteria: REQUIRED_CRITERIA.map((name, i) => {
        if (i === 0) {
          return {
            name,
            verdict: "FAIL" as const,
            findings: [
              {
                severity: "BLOCKER" as const,
                location: "src/utils.ts:42",
                issue: "Missing error handling",
                fix: "Add try/catch block",
              },
            ],
          };
        }
        return {
          name,
          verdict: "PASS" as const,
          findings: [],
        };
      }),
    };

    expect(() => ReviewOutputSchema.parse(reviewWithFindings)).not.toThrow();
  });
});

describe("computeCriterionVerdict", () => {
  it("returns PASS when there are no findings", () => {
    const findings: Finding[] = [];
    expect(computeCriterionVerdict(findings)).toBe("PASS");
  });

  it("returns PASS when there are only MINOR findings", () => {
    const findings: Finding[] = [
      {
        severity: "MINOR",
        location: "src/utils.ts:10",
        issue: "Consider using const",
        fix: "Change let to const",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("PASS");
  });

  it("returns PASS when there are only NIT findings", () => {
    const findings: Finding[] = [
      {
        severity: "NIT",
        location: "src/utils.ts:5",
        issue: "Missing trailing comma",
        fix: "Add trailing comma",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("PASS");
  });

  it("returns FAIL when there is a BLOCKER finding", () => {
    const findings: Finding[] = [
      {
        severity: "BLOCKER",
        location: "src/utils.ts:42",
        issue: "Security vulnerability",
        fix: "Use parameterized query",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("FAIL");
  });

  it("returns FAIL when there is a MAJOR finding", () => {
    const findings: Finding[] = [
      {
        severity: "MAJOR",
        location: "src/utils.ts:42",
        issue: "Missing input validation",
        fix: "Add zod schema",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("FAIL");
  });

  it("returns FAIL when there are mixed findings including BLOCKER", () => {
    const findings: Finding[] = [
      {
        severity: "MINOR",
        location: "src/utils.ts:10",
        issue: "Minor issue",
        fix: "Fix it",
      },
      {
        severity: "BLOCKER",
        location: "src/utils.ts:42",
        issue: "Critical issue",
        fix: "Fix it now",
      },
      {
        severity: "NIT",
        location: "src/utils.ts:5",
        issue: "Nit issue",
        fix: "Polish it",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("FAIL");
  });

  it("returns FAIL when there are mixed findings including MAJOR", () => {
    const findings: Finding[] = [
      {
        severity: "MINOR",
        location: "src/utils.ts:10",
        issue: "Minor issue",
        fix: "Fix it",
      },
      {
        severity: "MAJOR",
        location: "src/utils.ts:42",
        issue: "Major issue",
        fix: "Fix it",
      },
    ];
    expect(computeCriterionVerdict(findings)).toBe("FAIL");
  });
});

describe("computeOverallVerdict", () => {
  const createCriterion = (name: string, findings: Finding[]): CriterionReview => ({
    name,
    verdict: computeCriterionVerdict(findings),
    findings,
  });

  it("returns PASS when all criteria have no findings", () => {
    const criteria = Array.from({ length: 10 }, (_, i) =>
      createCriterion(`Criterion ${i + 1}`, [])
    );
    expect(computeOverallVerdict(criteria)).toBe("PASS");
  });

  it("returns PASS when there are only MINOR and NIT findings", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "MINOR", location: "file.ts:1", issue: "Issue", fix: "Fix" },
      ]),
      createCriterion("Criterion 2", [
        { severity: "NIT", location: "file.ts:2", issue: "Issue", fix: "Fix" },
      ]),
      ...Array.from({ length: 8 }, (_, i) => createCriterion(`Criterion ${i + 3}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("PASS");
  });

  it("returns PASS when there are 2 MAJOR findings (below threshold)", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "MAJOR", location: "file.ts:1", issue: "Issue 1", fix: "Fix 1" },
      ]),
      createCriterion("Criterion 2", [
        { severity: "MAJOR", location: "file.ts:2", issue: "Issue 2", fix: "Fix 2" },
      ]),
      ...Array.from({ length: 8 }, (_, i) => createCriterion(`Criterion ${i + 3}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("PASS");
  });

  it("returns FAIL when there is 1 BLOCKER finding", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "BLOCKER", location: "file.ts:1", issue: "Critical", fix: "Fix now" },
      ]),
      ...Array.from({ length: 9 }, (_, i) => createCriterion(`Criterion ${i + 2}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("FAIL");
  });

  it("returns FAIL when there are 3 MAJOR findings (at threshold)", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "MAJOR", location: "file.ts:1", issue: "Issue 1", fix: "Fix 1" },
      ]),
      createCriterion("Criterion 2", [
        { severity: "MAJOR", location: "file.ts:2", issue: "Issue 2", fix: "Fix 2" },
      ]),
      createCriterion("Criterion 3", [
        { severity: "MAJOR", location: "file.ts:3", issue: "Issue 3", fix: "Fix 3" },
      ]),
      ...Array.from({ length: 7 }, (_, i) => createCriterion(`Criterion ${i + 4}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("FAIL");
  });

  it("returns FAIL when there are 4 MAJOR findings (above threshold)", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "MAJOR", location: "file.ts:1", issue: "Issue 1", fix: "Fix 1" },
      ]),
      createCriterion("Criterion 2", [
        { severity: "MAJOR", location: "file.ts:2", issue: "Issue 2", fix: "Fix 2" },
      ]),
      createCriterion("Criterion 3", [
        { severity: "MAJOR", location: "file.ts:3", issue: "Issue 3", fix: "Fix 3" },
      ]),
      createCriterion("Criterion 4", [
        { severity: "MAJOR", location: "file.ts:4", issue: "Issue 4", fix: "Fix 4" },
      ]),
      ...Array.from({ length: 6 }, (_, i) => createCriterion(`Criterion ${i + 5}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("FAIL");
  });

  it("returns FAIL when there are multiple MAJOR in single criterion", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "MAJOR", location: "file.ts:1", issue: "Issue 1", fix: "Fix 1" },
        { severity: "MAJOR", location: "file.ts:2", issue: "Issue 2", fix: "Fix 2" },
        { severity: "MAJOR", location: "file.ts:3", issue: "Issue 3", fix: "Fix 3" },
      ]),
      ...Array.from({ length: 9 }, (_, i) => createCriterion(`Criterion ${i + 2}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("FAIL");
  });

  it("returns FAIL when there are BLOCKER and MAJOR mixed", () => {
    const criteria = [
      createCriterion("Criterion 1", [
        { severity: "BLOCKER", location: "file.ts:1", issue: "Critical", fix: "Fix" },
      ]),
      createCriterion("Criterion 2", [
        { severity: "MAJOR", location: "file.ts:2", issue: "Major", fix: "Fix" },
      ]),
      ...Array.from({ length: 8 }, (_, i) => createCriterion(`Criterion ${i + 3}`, [])),
    ];
    expect(computeOverallVerdict(criteria)).toBe("FAIL");
  });
});
