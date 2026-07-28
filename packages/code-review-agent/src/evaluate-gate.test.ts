import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { evaluateGate, gateProcessExitCode } from "./evaluate-gate.js";
import { REQUIRED_CRITERIA } from "./review-schema.js";

function createValidReview(majorCount = 0) {
  const criteria = REQUIRED_CRITERIA.map((name, index) => {
    if (index === 0 && majorCount > 0) {
      return {
        name,
        verdict: "FAIL",
        findings: Array.from({ length: majorCount }, (_, i) => ({
          severity: "MAJOR" as const,
          location: `src/api.ts:${i + 1}`,
          issue: "issue",
          fix: "fix",
        })),
      };
    }
    return { name, verdict: "PASS", findings: [] };
  });

  return {
    overall_verdict: "PASS",
    summary: "Test review.",
    criteria,
    questions: [],
  };
}

describe("evaluateGate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = resolve(
      tmpdir(),
      `evaluate-gate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes default policy with 2 major findings", () => {
    writeFileSync(
      resolve(tempDir, "review-output.json"),
      JSON.stringify(createValidReview(2)),
      "utf8",
    );

    const result = evaluateGate({
      reviewExitCode: "0",
      validationExitCode: "0",
      cwd: tempDir,
      policy: "default",
      mode: "advisory",
    });

    expect(result.passed).toBe(true);
    expect(gateProcessExitCode(result)).toBe(0);
  });

  it("fails default policy with 3 major findings in advisory (exit 0)", () => {
    writeFileSync(
      resolve(tempDir, "review-output.json"),
      JSON.stringify(createValidReview(3)),
      "utf8",
    );

    const result = evaluateGate({
      reviewExitCode: "0",
      validationExitCode: "0",
      cwd: tempDir,
      policy: "default",
      mode: "advisory",
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("3 major");
    expect(gateProcessExitCode(result)).toBe(0);
  });

  it("fails default policy with 3 major findings in enforce (exit 1)", () => {
    writeFileSync(
      resolve(tempDir, "review-output.json"),
      JSON.stringify(createValidReview(3)),
      "utf8",
    );

    const result = evaluateGate({
      reviewExitCode: "0",
      validationExitCode: "0",
      cwd: tempDir,
      policy: "default",
      mode: "enforce",
    });

    expect(result.passed).toBe(false);
    expect(gateProcessExitCode(result)).toBe(1);
  });

  it("fails closed when review agent failed", () => {
    const result = evaluateGate({
      reviewExitCode: "2",
      validationExitCode: "",
      cwd: tempDir,
      policy: "default",
      mode: "advisory",
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("Review agent failed");
  });

  it("fails closed when validation output is missing", () => {
    writeFileSync(
      resolve(tempDir, "review-output.json"),
      JSON.stringify(createValidReview(0)),
      "utf8",
    );

    const result = evaluateGate({
      reviewExitCode: "0",
      validationExitCode: "",
      cwd: tempDir,
      policy: "default",
      mode: "advisory",
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("Validation output missing");
  });
});
