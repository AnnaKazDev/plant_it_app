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
  normalizeReviewData,
  applyComputedVerdicts,
  type ReviewOutput,
} from "./review-schema.js";
import { renderMarkdown } from "./render-markdown.js";
import { resolveValidationExitCode } from "./review-ci.js";
import {
  extractUsefulLogContent,
  sanitizePrFailureContent,
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
  /** Large PASS/FAIL/ERROR headline for PR banner (e.g. "FAIL — merge blocked"). */
  headline: string;
  /** Markdown blockquote banner shown at top of PR comment. */
  bannerMarkdown: string;
  reviewVerdict: ReviewVerdictLabel;
  content: string;
  gateStatusText?: string;
  model?: string;
}

export type ReviewVerdictLabel = "PASS" | "FAIL" | "ERROR";

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

/** Severity counts for PR status (without PASS/FAIL label). */
export function buildFindingsSummary(review: ReviewOutput): string {
  const { blockerCount, majorCount, minorCount, nitCount } = countFindings(review);
  const totalIssues = blockerCount + majorCount + minorCount + nitCount;

  if (totalIssues === 0) {
    return "No issues found";
  }

  const parts: string[] = [];
  if (blockerCount > 0) parts.push(`🔴 ${blockerCount} blocker${blockerCount > 1 ? "s" : ""}`);
  if (majorCount > 0) parts.push(`🟡 ${majorCount} major`);
  if (minorCount > 0) parts.push(`🟢 ${minorCount} minor`);
  if (nitCount > 0) parts.push(`⚪ ${nitCount} nit${nitCount > 1 ? "s" : ""}`);

  return parts.join(", ");
}

/** @deprecated Use buildFindingsSummary — kept for tests that import severity summary. */
export function buildSeveritySummary(review: ReviewOutput): string {
  const findings = buildFindingsSummary(review);
  if (findings === "No issues found") {
    return findings;
  }
  const verdict = computeOverallVerdict(review.criteria);
  return `${verdict} | ${findings}`;
}

export function buildVerdictBanner(input: {
  reviewVerdict: ReviewVerdictLabel;
  findingsSummary: string;
  gateResult: GateResult | null;
  errorDetail?: string;
}): { headline: string; bannerMarkdown: string } {
  if (input.reviewVerdict === "ERROR") {
    const detail = input.errorDetail ?? input.findingsSummary;
    return {
      headline: "REVIEW ERROR",
      bannerMarkdown: `> ### ❌ REVIEW ERROR\n>\n> ${detail}`,
    };
  }

  const isPass = input.reviewVerdict === "PASS";
  const verdictEmoji = isPass ? "✅" : "🔴";
  const gate = input.gateResult;

  let mergeLine = "";
  if (gate && gate.mode !== "off") {
    if (gate.mode === "enforce") {
      mergeLine = gate.passed
        ? "> **Merge:** ✅ allowed (policy: " + gate.policy + ")"
        : "> **Merge:** 🚫 **BLOCKED** — " + gate.reason + " (policy: " + gate.policy + ")";
    } else if (gate.passed) {
      mergeLine = "> **Merge (advisory):** would pass (policy: " + gate.policy + ")";
    } else {
      mergeLine = "> **Merge (advisory):** ⚠️ would block — " + gate.reason;
    }
  }

  const findingsLine =
    input.findingsSummary === "No issues found"
      ? "> **Findings:** none"
      : `> **Findings:** ${input.findingsSummary}`;

  const headline = isPass
    ? gate?.mode === "enforce" && gate.passed
      ? "PASS — merge allowed"
      : "PASS"
    : gate?.mode === "enforce" && !gate.passed
      ? "FAIL — merge blocked"
      : "FAIL";

  let subtitle = "";
  if (isPass && gate?.mode === "enforce" && gate.passed) {
    subtitle = " — merge allowed";
  } else if (!isPass && gate?.mode === "enforce" && !gate.passed) {
    subtitle = " — merge blocked";
  }

  const bannerTitle = `### ${verdictEmoji} ${input.reviewVerdict}${subtitle}`;

  const lines = [`> ${bannerTitle}`, ">", findingsLine];
  if (mergeLine) {
    lines.push(mergeLine);
  }

  return {
    headline,
    bannerMarkdown: lines.join("\n"),
  };
}

function buildStatusFromReview(review: ReviewOutput): Pick<FormatPrCommentOutput, "statusText" | "emoji"> & {
  reviewVerdict: ReviewVerdictLabel;
} {
  const statusText = buildFindingsSummary(review);
  const { blockerCount, majorCount } = countFindings(review);
  const recomputedVerdict = computeOverallVerdict(review.criteria);
  const reviewVerdict: ReviewVerdictLabel = recomputedVerdict === "PASS" ? "PASS" : "FAIL";

  if (statusText === "No issues found") {
    return { emoji: "✅", statusText, reviewVerdict: "PASS" };
  }

  if (blockerCount > 0 || recomputedVerdict === "FAIL") {
    return { emoji: "🔴", statusText, reviewVerdict: "FAIL" };
  }
  if (majorCount > 0) {
    return { emoji: "🟡", statusText, reviewVerdict: "PASS" };
  }
  return { emoji: "🟢", statusText, reviewVerdict: "PASS" };
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
      ReviewOutputSchema.parse(normalizeReviewData(parsed)),
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
  return renderMarkdown(review);
}

type CommentResultCore = Omit<
  FormatPrCommentOutput,
  "model" | "bannerMarkdown" | "headline" | "reviewVerdict"
> & {
  reviewVerdict: ReviewVerdictLabel;
};

function withBanner(
  result: CommentResultCore,
  gateResult: GateResult | null,
  errorDetail?: string,
): Omit<FormatPrCommentOutput, "model"> {
  const { bannerMarkdown, headline } = buildVerdictBanner({
    reviewVerdict: result.reviewVerdict,
    findingsSummary: result.statusText,
    gateResult,
    errorDetail,
  });

  return {
    ...result,
    headline,
    bannerMarkdown,
  };
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
  const useful = extractUsefulLogContent(failureTxt, cleanTxt, logTxt);
  if (useful) {
    return useful;
  }

  return fallbackContent(
    cleanTxt ? sanitizePrFailureContent(cleanTxt) : null,
    `Review agent failed with exit code ${exitCode}. See workflow logs for full output.`,
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
  result: CommentResultCore,
  gateResult: GateResult | null,
): CommentResultCore {
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
  const core = buildFormatPrCommentResult(input);
  const withGate = attachGateStatus(core, gateResult);
  const result = withBanner(withGate, gateResult, core.errorDetail);
  const model = input.model?.trim();
  return model ? { ...result, model } : result;
}

function buildFormatPrCommentResult(
  input: FormatPrCommentInput,
): CommentResultCore & { errorDetail?: string } {
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
      const { statusText, emoji, reviewVerdict } = buildStatusFromReview(loaded.review);
      return {
        statusText: prefixStatus("Review failed", statusText),
        emoji,
        reviewVerdict,
        content: buildDetailContent(loaded.review),
      };
    }

    const statusText = buildReviewFailedStatus(input.exitCode, failureTxt);
    return {
      statusText,
      emoji: "❌",
      reviewVerdict: "ERROR",
      content: buildFailureContent(cleanTxt, failureTxt, logTxt, input.exitCode),
      errorDetail: statusText,
    };
  }

  if (validationFailed) {
    if (loaded.kind === "ok") {
      const { statusText, emoji, reviewVerdict } = buildStatusFromReview(loaded.review);
      const validationOutputMissing = input.validationExitCode === "";
      return {
        statusText: prefixStatus("Validation failed", statusText),
        emoji: validationOutputMissing ? "❌" : emoji,
        reviewVerdict: validationOutputMissing ? "ERROR" : reviewVerdict,
        content: buildDetailContent(loaded.review),
        errorDetail: validationOutputMissing ? "Validation failed" : undefined,
      };
    }

    return {
      statusText: "Validation failed",
      emoji: "❌",
      reviewVerdict: "ERROR",
      content: buildFailureContent(
        cleanTxt,
        failureTxt,
        logTxt,
        resolvedValidationExitCode,
      ),
      errorDetail: "Validation failed",
    };
  }

  if (loaded.kind === "missing") {
    return {
      statusText: "No structured output generated",
      emoji: "❌",
      reviewVerdict: "ERROR",
      content: fallbackContent(cleanTxt, "Review completed but produced no output"),
      errorDetail: "No structured output generated",
    };
  }

  if (loaded.kind === "error") {
    return {
      statusText: "JSON parse/validation failed",
      emoji: "❌",
      reviewVerdict: "ERROR",
      content: fallbackContent(cleanTxt, `Parse error: ${loaded.message}`),
      errorDetail: "JSON parse/validation failed",
    };
  }

  const { statusText, emoji, reviewVerdict } = buildStatusFromReview(loaded.review);
  return {
    statusText,
    emoji,
    reviewVerdict,
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
