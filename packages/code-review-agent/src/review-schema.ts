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
    .describe("FAIL if any criterion has BLOCKER or 3+ MAJOR findings, otherwise PASS"),
  summary: z.string().describe("2-4 sentences describing goal and scope of changes"),
  criteria: z.array(CriterionReviewSchema).describe("Review results for all 10 criteria"),
  questions: z.array(z.string()).optional().describe("Optional clarifying questions for the author"),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
