/**
 * Unit tests for format-pr-comment
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  formatPrComment,
  resolveValidationExitCode,
  type FormatPrCommentInput,
} from "./format-pr-comment.js";
import { REQUIRED_CRITERIA } from "./review-schema.js";

const CLI_PATH = resolve(import.meta.dirname, "format-pr-comment.ts");

function createValidReview(overrides: Record<string, unknown> = {}) {
  return {
    overall_verdict: "PASS",
    summary: "Clean changes.",
    criteria: REQUIRED_CRITERIA.map((name) => ({
      name,
      verdict: "PASS",
      findings: [],
    })),
    ...overrides,
  };
}

describe("resolveValidationExitCode", () => {
  it("fails closed when review succeeded but validation output is missing", () => {
    expect(resolveValidationExitCode("0", "")).toBe("1");
  });

  it("passes through validation code when review succeeded", () => {
    expect(resolveValidationExitCode("0", "0")).toBe("0");
    expect(resolveValidationExitCode("0", "1")).toBe("1");
  });

  it("defaults to 0 when review failed and validation was skipped", () => {
    expect(resolveValidationExitCode("2", "")).toBe("0");
  });
});

describe("formatPrComment", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `format-pr-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function run(input: Partial<FormatPrCommentInput> = {}) {
    return formatPrComment({
      exitCode: "0",
      validationExitCode: "0",
      cwd: tempDir,
      ...input,
    });
  }

  it("returns success status for a clean review", () => {
    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(createValidReview()), "utf8");
    writeFileSync(resolve(tempDir, "review-clean.txt"), "Detailed markdown", "utf8");

    const result = run();

    expect(result.emoji).toBe("✅");
    expect(result.statusText).toBe("No issues found");
    expect(result.content).toBe("Detailed markdown");
  });

  it("does not treat missing validation output as failure when review failed", () => {
    writeFileSync(
      resolve(tempDir, "review-failure.txt"),
      "### Review agent error\n\n**Reason:** Could not parse structured JSON from agent response\n\n**Details:** unbalanced braces\n",
      "utf8",
    );

    const result = run({ exitCode: "2", validationExitCode: "" });

    expect(result.emoji).toBe("❌");
    expect(result.statusText).toBe("Review failed | Agent output could not be parsed");
    expect(result.content).toContain("unbalanced braces");
  });

  it("prefers failure report over npm noise in logs", () => {
    writeFileSync(
      resolve(tempDir, "review-failure.txt"),
      "### Review agent error\n\n**Reason:** parse failed\n",
      "utf8",
    );
    writeFileSync(
      resolve(tempDir, "review-clean.txt"),
      "> @plant-it/code-review-agent@0.1.0 review\n> tsx src/review.ts\n",
      "utf8",
    );

    const result = run({ exitCode: "2", validationExitCode: "" });

    expect(result.content).toContain("parse failed");
    expect(result.content).not.toContain("tsx src/review.ts");
  });

  it("reports validation failure when review succeeded but validation output is missing", () => {
    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(createValidReview()), "utf8");

    const result = run({ exitCode: "0", validationExitCode: "" });

    expect(result.emoji).toBe("❌");
    expect(result.statusText).toBe("Validation failed | No issues found");
  });

  it("shows severity summary on validation failure when JSON is readable", () => {
    const review = createValidReview({
      overall_verdict: "FAIL",
      criteria: REQUIRED_CRITERIA.map((name, index) =>
        index === 4
          ? {
              name,
              verdict: "FAIL",
              findings: [
                {
                  severity: "MAJOR",
                  location: "src/api.ts:1",
                  issue: "Missing validation",
                  fix: "Add zod schema",
                },
              ],
            }
          : { name, verdict: "PASS", findings: [] },
      ),
    });

    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(review), "utf8");
    writeFileSync(resolve(tempDir, "review-clean.txt"), "### Summary\n\nDetails", "utf8");

    const result = run({ exitCode: "0", validationExitCode: "1" });

    expect(result.statusText).toBe("Validation failed | PASS | 🟡 1 major");
    expect(result.content).toMatch(/^PASS \| 🟡 1 major\n\n### Summary/);
  });

  it("computes FAIL status from blocker findings", () => {
    const review = createValidReview({
      overall_verdict: "FAIL",
      criteria: REQUIRED_CRITERIA.map((name, index) =>
        index === 4
          ? {
              name,
              verdict: "FAIL",
              findings: [
                {
                  severity: "BLOCKER",
                  location: "src/api.ts:1",
                  issue: "SQL injection",
                  fix: "Use parameterized queries",
                },
              ],
            }
          : { name, verdict: "PASS", findings: [] }
      ),
    });

    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(review), "utf8");
    writeFileSync(resolve(tempDir, "review-clean.txt"), "### Summary\n\nDetails", "utf8");

    const result = run();

    expect(result.emoji).toBe("🔴");
    expect(result.statusText).toContain("FAIL");
    expect(result.statusText).toContain("1 blocker");
    expect(result.content).toMatch(/^FAIL \| 🔴 1 blocker\n\n### Summary/);
  });

  it("accepts paraphrased criterion names via normalization", () => {
    const review = createValidReview({
      criteria: REQUIRED_CRITERIA.map((name) => ({
        name: name === "Security & Validation" ? "Security" : name,
        verdict: "PASS",
        findings: [],
      })),
    });

    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(review), "utf8");

    const result = run();

    expect(result.emoji).toBe("✅");
    expect(result.statusText).toBe("No issues found");
  });

  it("falls back to summary and rendered markdown when review-clean.txt is empty", () => {
    writeFileSync(resolve(tempDir, "review-clean.txt"), "", "utf8");
    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(createValidReview()), "utf8");

    const result = run();

    expect(result.emoji).toBe("✅");
    expect(result.statusText).toBe("No issues found");
    expect(result.content).toContain("Clean changes.");
    expect(result.content).toContain("### Summary");
    expect(result.content).toContain("### Findings");
  });

  it("returns parse error when JSON is invalid", () => {
    writeFileSync(resolve(tempDir, "review-output.json"), "{ bad json", "utf8");

    const result = run();

    expect(result.emoji).toBe("❌");
    expect(result.statusText).toBe("JSON parse/validation failed");
    expect(result.content).toContain("Parse error:");
  });

  it("returns no-output message when JSON file is missing on success path", () => {
    const result = run();

    expect(result.statusText).toBe("No structured output generated");
    expect(result.content).toBe("Review completed but produced no output");
  });
});

describe("format-pr-comment CLI", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `format-pr-comment-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(resolve(tempDir, "review-output.json"), JSON.stringify(createValidReview()), "utf8");
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes JSON to --output file", () => {
    const outputPath = resolve(tempDir, "comment.json");
    execSync(
      `tsx ${CLI_PATH} --exit-code 0 --validation-exit-code 0 --cwd ${tempDir} --output comment.json`,
      { encoding: "utf8" }
    );

    const parsed = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(parsed.emoji).toBe("✅");
    expect(parsed.statusText).toBe("No issues found");
  });
});
