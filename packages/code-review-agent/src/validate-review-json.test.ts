/**
 * Unit tests for validate-review-json CLI entrypoint
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { REQUIRED_CRITERIA } from "./review-schema.js";

const CLI_PATH = resolve(import.meta.dirname, "validate-review-json.ts");

describe("validate-review-json CLI", () => {
  let tempFile: string;

  beforeEach(() => {
    // Create unique temp file for each test
    tempFile = resolve(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  });

  afterEach(() => {
    // Cleanup temp file
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  it("validates valid JSON and exits 0", () => {
    const validReview = {
      overall_verdict: "PASS",
      summary: "Test summary",
      criteria: REQUIRED_CRITERIA.map(name => ({
        name,
        verdict: "PASS",
        findings: [],
      })),
      questions: [],
    };

    writeFileSync(tempFile, JSON.stringify(validReview, null, 2), "utf8");

    const result = execSync(`tsx ${CLI_PATH} ${tempFile}`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(result).toContain("✓ Valid JSON schema");
    expect(result).toContain("Overall verdict: PASS");
  });

  it("exits 1 when file does not exist", () => {
    const nonExistentFile = resolve(tmpdir(), "does-not-exist.json");

    expect(() => {
      execSync(`tsx ${CLI_PATH} ${nonExistentFile}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  it("exits 1 when JSON is malformed", () => {
    writeFileSync(tempFile, "{ not valid json }", "utf8");

    expect(() => {
      execSync(`tsx ${CLI_PATH} ${tempFile}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  it("exits 1 when schema is invalid (missing required fields)", () => {
    const invalidReview = {
      overall_verdict: "PASS",
      // missing summary
      criteria: [],
    };

    writeFileSync(tempFile, JSON.stringify(invalidReview, null, 2), "utf8");

    expect(() => {
      execSync(`tsx ${CLI_PATH} ${tempFile}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  it("exits 1 when schema is invalid (wrong number of criteria)", () => {
    const invalidReview = {
      overall_verdict: "PASS",
      summary: "Test",
      criteria: [
        { name: "Only One", verdict: "PASS", findings: [] },
      ],
      questions: [],
    };

    writeFileSync(tempFile, JSON.stringify(invalidReview, null, 2), "utf8");

    expect(() => {
      execSync(`tsx ${CLI_PATH} ${tempFile}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  it("recomputes and writes corrected verdicts", () => {
    // Create review with incorrect verdict (PASS despite BLOCKER)
    const reviewWithWrongVerdict = {
      overall_verdict: "PASS", // Wrong - should be FAIL
      summary: "Test summary",
      criteria: REQUIRED_CRITERIA.map((name, i) => {
        if (i === 0) {
          return {
            name,
            verdict: "PASS", // Wrong - should be FAIL
            findings: [
              {
                severity: "BLOCKER",
                location: "test.ts:1",
                issue: "Critical issue",
                fix: "Fix it",
              },
            ],
          };
        }
        return {
          name,
          verdict: "PASS",
          findings: [],
        };
      }),
      questions: [],
    };

    writeFileSync(tempFile, JSON.stringify(reviewWithWrongVerdict, null, 2), "utf8");

    const result = execSync(`tsx ${CLI_PATH} ${tempFile}`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(result).toContain("✓ Valid JSON schema");
    expect(result).toContain("Overall verdict: FAIL");

    // Read back the file and verify verdicts were corrected
    const rewritten = JSON.parse(readFileSync(tempFile, "utf8"));
    expect(rewritten.overall_verdict).toBe("FAIL");
    expect(rewritten.criteria[0].verdict).toBe("FAIL");
  });

  it("recomputes overall verdict from 3+ MAJOR findings", () => {
    const reviewWith3Major = {
      overall_verdict: "PASS", // Wrong - should be FAIL
      summary: "Test summary",
      criteria: REQUIRED_CRITERIA.map((name, i) => {
        if (i < 3) {
          return {
            name,
            verdict: "FAIL",
            findings: [
              {
                severity: "MAJOR",
                location: `test${i}.ts:1`,
                issue: "Major issue",
                fix: "Fix it",
              },
            ],
          };
        }
        return {
          name,
          verdict: "PASS",
          findings: [],
        };
      }),
      questions: [],
    };

    writeFileSync(tempFile, JSON.stringify(reviewWith3Major, null, 2), "utf8");

    const result = execSync(`tsx ${CLI_PATH} ${tempFile}`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(result).toContain("Overall verdict: FAIL");

    const rewritten = JSON.parse(readFileSync(tempFile, "utf8"));
    expect(rewritten.overall_verdict).toBe("FAIL");
  });

  it("keeps PASS verdict when only MINOR/NIT findings", () => {
    const reviewWithMinor = {
      overall_verdict: "PASS",
      summary: "Test summary",
      criteria: REQUIRED_CRITERIA.map((name, i) => {
        if (i === 0) {
          return {
            name,
            verdict: "PASS",
            findings: [
              {
                severity: "MINOR",
                location: "test.ts:1",
                issue: "Minor issue",
                fix: "Fix it",
              },
            ],
          };
        }
        return {
          name,
          verdict: "PASS",
          findings: [],
        };
      }),
      questions: [],
    };

    writeFileSync(tempFile, JSON.stringify(reviewWithMinor, null, 2), "utf8");

    const result = execSync(`tsx ${CLI_PATH} ${tempFile}`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(result).toContain("Overall verdict: PASS");

    const rewritten = JSON.parse(readFileSync(tempFile, "utf8"));
    expect(rewritten.overall_verdict).toBe("PASS");
    expect(rewritten.criteria[0].verdict).toBe("PASS");
  });
});
