#!/usr/bin/env node
/**
 * Format PR comment metadata from review outputs.
 * Used by the ai-review workflow instead of inlining validation logic.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ReviewOutputSchema,
  computeOverallVerdict,
  normalizeCriteriaNames,
  type ReviewOutput,
} from "./review-schema.js";

export interface FormatPrCommentInput {
  exitCode: string;
  validationExitCode: string;
  jsonPath?: string;
  cleanTxtPath?: string;
  cwd?: string;
}

export interface FormatPrCommentOutput {
  statusText: string;
  emoji: string;
  content: string;
}

/**
 * Resolve validation exit code with fail-closed semantics.
 * The validate step runs only when review exit code is 0; a missing output then means failure.
 */
export function resolveValidationExitCode(exitCode: string, validationExitCode: string): string {
  if (exitCode === "0" && !validationExitCode) {
    return "1";
  }
  return validationExitCode || "0";
}

function readTextFile(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function countFindings(review: ReviewOutput) {
  let blockerCount = 0;
  let majorCount = 0;
  let minorCount = 0;
  let nitCount = 0;

  for (const criterion of review.criteria) {
    for (const finding of criterion.findings) {
      if (finding.severity === "BLOCKER") blockerCount++;
      else if (finding.severity === "MAJOR") majorCount++;
      else if (finding.severity === "MINOR") minorCount++;
      else if (finding.severity === "NIT") nitCount++;
    }
  }

  return { blockerCount, majorCount, minorCount, nitCount };
}

function buildStatusFromReview(review: ReviewOutput): Pick<FormatPrCommentOutput, "statusText" | "emoji"> {
  const { blockerCount, majorCount, minorCount, nitCount } = countFindings(review);
  const totalIssues = blockerCount + majorCount + minorCount + nitCount;
  const recomputedVerdict = computeOverallVerdict(review.criteria);

  if (totalIssues === 0) {
    return { emoji: "✅", statusText: "No issues found" };
  }

  const parts: string[] = [];
  if (blockerCount > 0) parts.push(`🔴 ${blockerCount} blocker${blockerCount > 1 ? "s" : ""}`);
  if (majorCount > 0) parts.push(`🟡 ${majorCount} major`);
  if (minorCount > 0) parts.push(`🟢 ${minorCount} minor`);
  if (nitCount > 0) parts.push(`⚪ ${nitCount} nit${nitCount > 1 ? "s" : ""}`);

  const statusText = `${recomputedVerdict} | ${parts.join(", ")}`;

  if (blockerCount > 0 || recomputedVerdict === "FAIL") {
    return { emoji: "🔴", statusText };
  }
  if (majorCount > 0) {
    return { emoji: "🟡", statusText };
  }
  return { emoji: "🟢", statusText };
}

export function formatPrComment(input: FormatPrCommentInput): FormatPrCommentOutput {
  const cwd = input.cwd ?? process.cwd();
  const jsonPath = resolve(cwd, input.jsonPath ?? "review-output.json");
  const cleanTxtPath = resolve(cwd, input.cleanTxtPath ?? "review-clean.txt");
  const cleanTxt = readTextFile(cleanTxtPath);

  const resolvedValidationExitCode = resolveValidationExitCode(input.exitCode, input.validationExitCode);
  const hasFailure = input.exitCode !== "0" || resolvedValidationExitCode !== "0";

  if (hasFailure) {
    const statusText =
      input.exitCode === "0" && resolvedValidationExitCode !== "0" ? "Validation failed" : "Review failed";
    const content =
      cleanTxt ??
      `Review agent failed with exit code ${input.exitCode}${
        resolvedValidationExitCode !== "0" ? `, validation exit code ${resolvedValidationExitCode}` : ""
      }`;

    return { statusText, emoji: "❌", content };
  }

  if (!existsSync(jsonPath)) {
    return {
      statusText: "No structured output generated",
      emoji: "❌",
      content: cleanTxt ?? "Review completed but produced no output",
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    const review = ReviewOutputSchema.parse(normalizeCriteriaNames(parsed));
    const { statusText, emoji } = buildStatusFromReview(review);
    const content = cleanTxt ?? review.summary;

    return { statusText, emoji, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusText: "JSON parse/validation failed",
      emoji: "❌",
      content: cleanTxt ?? `Parse error: ${message}`,
    };
  }
}

function parseArgs(argv: string[]): { input: FormatPrCommentInput; outputPath?: string } {
  const input: FormatPrCommentInput = {
    exitCode: "0",
    validationExitCode: "",
  };
  let outputPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--exit-code") {
      input.exitCode = argv[++i] ?? "0";
    } else if (arg === "--validation-exit-code") {
      input.validationExitCode = argv[++i] ?? "";
    } else if (arg === "--json-path") {
      input.jsonPath = argv[++i];
    } else if (arg === "--clean-txt-path") {
      input.cleanTxtPath = argv[++i];
    } else if (arg === "--cwd") {
      input.cwd = argv[++i];
    } else if (arg === "--output") {
      outputPath = argv[++i];
    }
  }

  return { input, outputPath };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const { input, outputPath } = parseArgs(process.argv.slice(2));
  const result = formatPrComment(input);
  const json = JSON.stringify(result);

  if (outputPath) {
    writeFileSync(resolve(input.cwd ?? process.cwd(), outputPath), json, "utf8");
  } else {
    process.stdout.write(json);
  }
}
