/**
 * Structured output schema for code review.
 * Enforces consistent format for mechanical pass/fail decisions in CI/CD.
 */
import { z } from "zod";

export const SeveritySchema = z.enum(["BLOCKER", "MAJOR", "MINOR", "NIT"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingSchema = z.object({
  severity: SeveritySchema,
  location: z.string().describe("File path and line number (e.g., 'src/utils.ts:42')"),
  issue: z.string().describe("Explanation of the problem and its impact"),
  fix: z.string().describe("Concrete code snippet or instruction to fix the issue"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const CriterionReviewSchema = z.object({
  name: z.string().describe("Criterion name (e.g., 'Stack Conventions', 'Security')"),
  verdict: z.enum(["PASS", "FAIL"]).describe("FAIL if any BLOCKER or MAJOR finding, otherwise PASS"),
  findings: z.array(FindingSchema).describe("List of findings for this criterion (empty array if none)"),
});
export type CriterionReview = z.infer<typeof CriterionReviewSchema>;

export const ReviewOutputSchema = z.object({
  overall_verdict: z
    .enum(["PASS", "FAIL"])
    .describe("FAIL if any BLOCKER or 3+ MAJOR findings across all criteria combined, otherwise PASS"),
  summary: z.string().describe("2-4 sentences describing goal and scope of changes"),
  criteria: z
    .array(CriterionReviewSchema)
    .length(10)
    .describe("Review results for all 10 criteria"),
  questions: z.array(z.string()).optional().describe("Optional clarifying questions for the author"),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/**
 * Compute criterion verdict based on findings.
 * FAIL if any BLOCKER or MAJOR finding, otherwise PASS.
 */
export function computeCriterionVerdict(findings: Finding[]): "PASS" | "FAIL" {
  const hasBlockerOrMajor = findings.some(
    (f) => f.severity === "BLOCKER" || f.severity === "MAJOR"
  );
  return hasBlockerOrMajor ? "FAIL" : "PASS";
}

/**
 * Compute overall verdict based on all criteria findings.
 * FAIL if any BLOCKER or 3+ MAJOR findings across all criteria, otherwise PASS.
 */
export function computeOverallVerdict(criteria: CriterionReview[]): "PASS" | "FAIL" {
  let blockerCount = 0;
  let majorCount = 0;

  for (const criterion of criteria) {
    for (const finding of criterion.findings) {
      if (finding.severity === "BLOCKER") blockerCount++;
      if (finding.severity === "MAJOR") majorCount++;
    }
  }

  return blockerCount > 0 || majorCount >= 3 ? "FAIL" : "PASS";
}
