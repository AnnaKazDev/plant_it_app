import type { CriterionReview } from "./review-schema.js";

export type GatePolicy = "blocker-only" | "default" | "strict";
export type GateMode = "advisory" | "enforce" | "off";

export interface FindingCounts {
  blockerCount: number;
  majorCount: number;
  minorCount: number;
  nitCount: number;
}

export interface GateResult {
  passed: boolean;
  policy: GatePolicy;
  mode: GateMode;
  reason: string;
  counts: FindingCounts;
  /** PR-facing one-liner for merge gate status. */
  statusText: string;
}

export function countFindingSeverities(criteria: CriterionReview[]): FindingCounts {
  let blockerCount = 0;
  let majorCount = 0;
  let minorCount = 0;
  let nitCount = 0;

  for (const criterion of criteria) {
    for (const finding of criterion.findings) {
      if (finding.severity === "BLOCKER") blockerCount++;
      else if (finding.severity === "MAJOR") majorCount++;
      else if (finding.severity === "MINOR") minorCount++;
      else if (finding.severity === "NIT") nitCount++;
    }
  }

  return { blockerCount, majorCount, minorCount, nitCount };
}

/**
 * Mechanical pass/fail for merge gate policy presets.
 * - blocker-only: any BLOCKER fails
 * - default: any BLOCKER or 3+ MAJOR fails
 * - strict: any BLOCKER or MAJOR fails
 */
export function evaluatePolicyPass(policy: GatePolicy, counts: FindingCounts): boolean {
  if (counts.blockerCount > 0) {
    return false;
  }

  if (policy === "blocker-only") {
    return true;
  }

  if (policy === "strict" && counts.majorCount > 0) {
    return false;
  }

  if (policy === "default" && counts.majorCount >= 3) {
    return false;
  }

  return true;
}

function buildPolicyFailureReason(policy: GatePolicy, counts: FindingCounts): string {
  if (counts.blockerCount > 0) {
    return `${counts.blockerCount} blocker${counts.blockerCount > 1 ? "s" : ""} found`;
  }

  if (policy === "strict" && counts.majorCount > 0) {
    return `${counts.majorCount} major finding${counts.majorCount > 1 ? "s" : ""} found`;
  }

  if (policy === "default" && counts.majorCount >= 3) {
    return `${counts.majorCount} major findings (threshold: 3)`;
  }

  return "policy violation";
}

export function formatGateStatusText(result: GateResult): string {
  if (result.mode === "off") {
    return "Merge gate disabled";
  }

  if (result.mode === "advisory") {
    if (result.passed) {
      return `Would pass (policy: ${result.policy}, mode: advisory)`;
    }
    return `Would block — ${result.reason} (policy: ${result.policy}, mode: advisory)`;
  }

  if (result.passed) {
    return `Passed (policy: ${result.policy})`;
  }

  return `Blocked — ${result.reason} (policy: ${result.policy})`;
}

export function buildGateResult(
  passed: boolean,
  policy: GatePolicy,
  mode: GateMode,
  reason: string,
  counts: FindingCounts,
): GateResult {
  const result: GateResult = {
    passed,
    policy,
    mode,
    reason,
    counts,
    statusText: "",
  };
  result.statusText = formatGateStatusText(result);
  return result;
}

export function gateResultFromPolicyViolation(
  policy: GatePolicy,
  mode: GateMode,
  counts: FindingCounts,
): GateResult {
  const reason = buildPolicyFailureReason(policy, counts);
  return buildGateResult(false, policy, mode, reason, counts);
}

export function gateResultFromTechnicalFailure(
  policy: GatePolicy,
  mode: GateMode,
  reason: string,
): GateResult {
  const counts: FindingCounts = {
    blockerCount: 0,
    majorCount: 0,
    minorCount: 0,
    nitCount: 0,
  };
  return buildGateResult(false, policy, mode, reason, counts);
}

export function gateResultFromPass(
  policy: GatePolicy,
  mode: GateMode,
  counts: FindingCounts,
): GateResult {
  return buildGateResult(true, policy, mode, "No gate violations", counts);
}
