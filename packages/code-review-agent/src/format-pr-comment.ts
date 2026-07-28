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
  applyComputedVerdicts,
  type ReviewOutput,
} from "./review-schema.js";
import { renderMarkdown } from "./render-markdown.js";
import { resolveValidationExitCode } from "./review-ci.js";
import {
  extractUsefulLogContent,
  REVIEW_FAILURE_FILENAME,
} from "./review-failure.js";
import type { GateResult } from "./gate-policy.js";

export interface FormatPrCommentInput {
  exitCode: string;
  validationExitCode: string;
  jsonPath?: string;
  cleanTxtPath?: string;
  failureTxtPath?: string;
  logTxtPath?: string;
  gateResultPath?: string;
  cwd?: string;
  model?: string;
}

export interface FormatPrCommentOutput {
  statusText: string;
  emoji: string;
  content: string;
  gateStatusText?: string;
  model?: string;
}

/**
 * Resolve validation exit code with fail-closed semantics.
 * The validate step runs only when review exit code is 0; a missing output then means failure.
 */
export { resolveValidationExitCode } from "./review-ci.js";

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

/** Colored severity summary line shown in PR status and as first line of details. */
export function buildSeveritySummary(review: ReviewOutput): string {
  const { blockerCount, majorCount, minorCount, nitCount } = countFindings(review);
  const totalIssues = blockerCount + majorCount + minorCount + nitCount;
  const recomputedVerdict = computeOverallVerdict(review.criteria);

  if (totalIssues === 0) {
    return "No issues found";
  }

  const parts: string[] = [];
  if (blockerCount > 0) parts.push(`🔴 ${blockerCount} blocker${blockerCount > 1 ? "s" : ""}`);
  if (majorCount > 0) parts.push(`🟡 ${majorCount} major`);
  if (minorCount > 0) parts.push(`🟢 ${minorCount} minor`);
  if (nitCount > 0) parts.push(`⚪ ${nitCount} nit${nitCount > 1 ? "s" : ""}`);

  return `${recomputedVerdict} | ${parts.join(", ")}`;
}

function buildStatusFromReview(review: ReviewOutput): Pick<FormatPrCommentOutput, "statusText" | "emoji"> {
  const statusText = buildSeveritySummary(review);
  const { blockerCount, majorCount } = countFindings(review);
  const recomputedVerdict = computeOverallVerdict(review.criteria);

  if (statusText === "No issues found") {
    return { emoji: "✅", statusText };
  }

  if (blockerCount > 0 || recomputedVerdict === "FAIL") {
    return { emoji: "🔴", statusText };
  }
  if (majorCount > 0) {
    return { emoji: "🟡", statusText };
  }
  return { emoji: "🟢", statusText };
}

type LoadedReview =
  | { kind: "ok"; review: ReviewOutput }
  | { kind: "error"; message: string }
  | { kind: "missing" };

function loadReview(jsonPath: string): LoadedReview {
  if (!existsSync(jsonPath)) {
    return { kind: "missing" };
  }

  try {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    const review = applyComputedVerdicts(
      ReviewOutputSchema.parse(normalizeCriteriaNames(parsed)),
    );
    return { kind: "ok", review };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Render PR-facing content straight from the validated structured review.
 * Deliberately does NOT fall back to review-clean.txt: that file is the raw
 * combined stdout+stderr CI log (diff progress, run ids, node warnings, dots),
 * and once we have valid structured JSON, that log is noise, not content.
 */
function buildDetailContent(review: ReviewOutput): string {
  const body = renderMarkdown(review);
  const severityLine = buildSeveritySummary(review);

  if (severityLine === "No issues found") {
    return body;
  }

  return `${severityLine}\n\n${body}`;
}

function prefixStatus(prefix: string, statusText: string): string {
  return `${prefix} | ${statusText}`;
}

function fallbackContent(cleanTxt: string | null, fallback: string): string {
  return cleanTxt?.trim() || fallback;
}

function buildFailureContent(
  cleanTxt: string | null,
  failureTxt: string | null,
  logTxt: string | null,
  exitCode: string,
): string {
  return (
    extractUsefulLogContent(failureTxt, cleanTxt, logTxt) ??
    fallbackContent(cleanTxt, `Review agent failed with exit code ${exitCode}`)
  );
}

function buildReviewFailedStatus(exitCode: string, failureTxt: string | null): string {
  if (failureTxt?.includes("Could not parse structured JSON")) {
    return "Review failed | Agent output could not be parsed";
  }
  if (failureTxt?.includes("Could not start review agent")) {
    return "Review failed | Agent startup error";
  }
  return `Review failed | Exit code ${exitCode}`;
}

function readGateResult(path: string): GateResult | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as GateResult;
  } catch {
    return null;
  }
}

function attachGateStatus(
  result: Omit<FormatPrCommentOutput, "model">,
  gateResult: GateResult | null,
): Omit<FormatPrCommentOutput, "model"> {
  if (!gateResult?.statusText) {
    return result;
  }

  return { ...result, gateStatusText: gateResult.statusText };
}

export function formatPrComment(input: FormatPrCommentInput): FormatPrCommentOutput {
  const cwd = input.cwd ?? process.cwd();
  const gateResultPath = input.gateResultPath
    ? resolve(cwd, input.gateResultPath)
    : undefined;
  const gateResult = gateResultPath ? readGateResult(gateResultPath) : null;
  const result = attachGateStatus(buildFormatPrCommentResult(input), gateResult);
  const model = input.model?.trim();
  return model ? { ...result, model } : result;
}

function buildFormatPrCommentResult(
  input: FormatPrCommentInput,
): Omit<FormatPrCommentOutput, "model"> {
  const cwd = input.cwd ?? process.cwd();
  const jsonPath = resolve(cwd, input.jsonPath ?? "review-output.json");
  const cleanTxtPath = resolve(cwd, input.cleanTxtPath ?? "review-clean.txt");
  const failureTxtPath = resolve(cwd, input.failureTxtPath ?? REVIEW_FAILURE_FILENAME);
  const logTxtPath = resolve(cwd, input.logTxtPath ?? "review-output.txt");
  const cleanTxt = readTextFile(cleanTxtPath);
  const failureTxt = readTextFile(failureTxtPath);
  const logTxt = readTextFile(logTxtPath);
  const loaded = loadReview(jsonPath);

  const resolvedValidationExitCode = resolveValidationExitCode(input.exitCode, input.validationExitCode);
  const reviewFailed = input.exitCode !== "0";
  const validationFailed = !reviewFailed && resolvedValidationExitCode !== "0";

  if (reviewFailed) {
    if (loaded.kind === "ok") {
      const { statusText, emoji } = buildStatusFromReview(loaded.review);
      return {
        statusText: prefixStatus("Review failed", statusText),
        emoji,
        content: buildDetailContent(loaded.review),
      };
    }

    return {
      statusText: buildReviewFailedStatus(input.exitCode, failureTxt),
      emoji: "❌",
      content: buildFailureContent(cleanTxt, failureTxt, logTxt, input.exitCode),
    };
  }

  if (validationFailed) {
    if (loaded.kind === "ok") {
      const { statusText, emoji } = buildStatusFromReview(loaded.review);
      const validationOutputMissing = input.validationExitCode === "";
      return {
        statusText: prefixStatus("Validation failed", statusText),
        emoji: validationOutputMissing ? "❌" : emoji,
        content: buildDetailContent(loaded.review),
      };
    }

    return {
      statusText: "Validation failed",
      emoji: "❌",
      content: buildFailureContent(
        cleanTxt,
        failureTxt,
        logTxt,
        resolvedValidationExitCode,
      ),
    };
  }

  if (loaded.kind === "missing") {
    return {
      statusText: "No structured output generated",
      emoji: "❌",
      content: fallbackContent(cleanTxt, "Review completed but produced no output"),
    };
  }

  if (loaded.kind === "error") {
    return {
      statusText: "JSON parse/validation failed",
      emoji: "❌",
      content: fallbackContent(cleanTxt, `Parse error: ${loaded.message}`),
    };
  }

  const { statusText, emoji } = buildStatusFromReview(loaded.review);
  return {
    statusText,
    emoji,
    content: buildDetailContent(loaded.review),
  };
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
    } else if (arg === "--failure-txt-path") {
      input.failureTxtPath = argv[++i];
    } else if (arg === "--log-txt-path") {
      input.logTxtPath = argv[++i];
    } else if (arg === "--gate-result-path") {
      input.gateResultPath = argv[++i];
    } else if (arg === "--cwd") {
      input.cwd = argv[++i];
    } else if (arg === "--model") {
      input.model = argv[++i];
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
