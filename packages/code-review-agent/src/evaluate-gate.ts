#!/usr/bin/env node
/**
 * Evaluate merge gate from structured review output and CI exit codes.
 * In advisory mode the process always exits 0; in enforce mode exits 1 when blocked.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type GateMode,
  type GatePolicy,
  type GateResult,
  countFindingSeverities,
  evaluatePolicyPass,
  gateResultFromPass,
  gateResultFromPolicyViolation,
  gateResultFromTechnicalFailure,
} from "./gate-policy.js";
import {
  ReviewOutputSchema,
  applyComputedVerdicts,
  normalizeReviewData,
  type ReviewOutput,
} from "./review-schema.js";
import { resolveValidationExitCode } from "./review-ci.js";

export interface EvaluateGateInput {
  reviewExitCode: string;
  validationExitCode: string;
  jsonPath?: string;
  cwd?: string;
  policy?: GatePolicy;
  mode?: GateMode;
}

const EMPTY_COUNTS = {
  blockerCount: 0,
  majorCount: 0,
  minorCount: 0,
  nitCount: 0,
};

function parsePolicy(value: string | undefined): GatePolicy {
  if (value === "blocker-only" || value === "strict" || value === "default") {
    return value;
  }
  return "default";
}

function parseMode(value: string | undefined): GateMode {
  if (value === "enforce" || value === "advisory" || value === "off") {
    return value;
  }
  return "advisory";
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

export function evaluateGate(input: EvaluateGateInput): GateResult {
  const policy = input.policy ?? "default";
  const mode = input.mode ?? "advisory";
  const cwd = input.cwd ?? process.cwd();
  const jsonPath = resolve(cwd, input.jsonPath ?? "review-output.json");

  if (mode === "off") {
    return gateResultFromPass(policy, mode, EMPTY_COUNTS);
  }

  const resolvedValidationExitCode = resolveValidationExitCode(
    input.reviewExitCode,
    input.validationExitCode,
  );
  const reviewFailed = input.reviewExitCode !== "0";
  const validationFailed = !reviewFailed && resolvedValidationExitCode !== "0";

  if (reviewFailed) {
    return gateResultFromTechnicalFailure(policy, mode, "Review agent failed");
  }

  if (validationFailed) {
    const reason =
      input.validationExitCode === ""
        ? "Validation output missing after successful review"
        : "Review JSON validation failed";
    return gateResultFromTechnicalFailure(policy, mode, reason);
  }

  const loaded = loadReview(jsonPath);

  if (loaded.kind === "missing") {
    return gateResultFromTechnicalFailure(policy, mode, "No structured review output");
  }

  if (loaded.kind === "error") {
    return gateResultFromTechnicalFailure(
      policy,
      mode,
      `Could not parse review JSON: ${loaded.message}`,
    );
  }

  const counts = countFindingSeverities(loaded.review.criteria);
  if (evaluatePolicyPass(policy, counts)) {
    return gateResultFromPass(policy, mode, counts);
  }

  return gateResultFromPolicyViolation(policy, mode, counts);
}

export function gateProcessExitCode(result: GateResult): number {
  if (result.mode === "enforce" && !result.passed) {
    return 1;
  }
  return 0;
}

function parseArgs(argv: string[]): { input: EvaluateGateInput; outputPath?: string } {
  const input: EvaluateGateInput = {
    reviewExitCode: "0",
    validationExitCode: "",
  };
  let outputPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--review-exit-code") {
      input.reviewExitCode = argv[++i] ?? "0";
    } else if (arg === "--validation-exit-code") {
      input.validationExitCode = argv[++i] ?? "";
    } else if (arg === "--json-path") {
      input.jsonPath = argv[++i];
    } else if (arg === "--cwd") {
      input.cwd = argv[++i];
    } else if (arg === "--policy") {
      input.policy = parsePolicy(argv[++i]);
    } else if (arg === "--mode") {
      input.mode = parseMode(argv[++i]);
    } else if (arg === "--output") {
      outputPath = argv[++i];
    }
  }

  return { input, outputPath };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const { input, outputPath } = parseArgs(process.argv.slice(2));
  const result = evaluateGate(input);
  const json = JSON.stringify(result);

  if (outputPath) {
    writeFileSync(resolve(input.cwd ?? process.cwd(), outputPath), json, "utf8");
  } else {
    process.stdout.write(json);
  }

  const exitCode = gateProcessExitCode(result);
  if (exitCode !== 0) {
    console.error(`[evaluate-gate] Merge gate blocked: ${result.reason}`);
  } else if (!result.passed) {
    console.error(`[evaluate-gate] Merge gate would block (advisory): ${result.reason}`);
  } else {
    console.log(`[evaluate-gate] Merge gate passed (mode=${result.mode}, policy=${result.policy})`);
  }

  process.exit(exitCode);
}
