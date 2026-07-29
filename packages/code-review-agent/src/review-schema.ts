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

/** Canonical criterion names in required order */
export const REQUIRED_CRITERIA = [
  "Stack Conventions (Astro + React + Cloudflare)",
  "Tailwind Class Handling",
  "Supabase Patterns",
  "Cloudflare Workers CPU Constraint",
  "Security & Validation",
  "Code Quality & TypeScript",
  "Testing",
  "Performance & Optimization",
  "Logic & Error Handling",
  "Lessons Learned Compliance",
] as const;

export const CriterionReviewSchema = z.object({
  name: z.string().describe("Criterion name (e.g., 'Stack Conventions', 'Security')"),
  verdict: z.enum(["PASS", "FAIL"]).describe("FAIL if any BLOCKER or MAJOR finding, otherwise PASS"),
  findings: z.array(FindingSchema).describe("List of findings for this criterion (empty array if none)"),
});
export type CriterionReview = z.infer<typeof CriterionReviewSchema>;

export const ReviewOutputSchema = z
  .object({
    overall_verdict: z
      .enum(["PASS", "FAIL"])
      .describe("FAIL if any BLOCKER or 3+ MAJOR findings across all criteria combined, otherwise PASS"),
    summary: z.string().describe("2-4 sentences describing goal and scope of changes"),
    criteria: z
      .array(CriterionReviewSchema)
      .length(10)
      .describe("Review results for all 10 criteria"),
    questions: z
      .array(z.string())
      .optional()
      .nullable()
      .describe("Optional clarifying questions for the author"),
  })
  .refine(
    (data) => {
      // Validate criteria names match required list in order
      return data.criteria.every((criterion, index) => criterion.name === REQUIRED_CRITERIA[index]);
    },
    {
      message: `Criteria must match required names in order: ${REQUIRED_CRITERIA.join(", ")}`,
    }
  );
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

export class CriteriaMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriteriaMappingError";
  }
}

function normalizeCriterionKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CRITERION_ALIASES: Record<string, (typeof REQUIRED_CRITERIA)[number]> = {};

function registerAliases(
  canonical: (typeof REQUIRED_CRITERIA)[number],
  ...aliases: string[]
): void {
  CRITERION_ALIASES[normalizeCriterionKey(canonical)] = canonical;
  for (const alias of aliases) {
    CRITERION_ALIASES[normalizeCriterionKey(alias)] = canonical;
  }
}

registerAliases(
  "Stack Conventions (Astro + React + Cloudflare)",
  "stack conventions",
  "astro react cloudflare",
);
registerAliases("Tailwind Class Handling", "tailwind", "tailwind handling");
registerAliases("Supabase Patterns", "supabase", "supabase patterns");
registerAliases(
  "Cloudflare Workers CPU Constraint",
  "cloudflare",
  "cloudflare cpu",
  "cloudflare workers",
);
registerAliases("Security & Validation", "security", "security validation");
registerAliases("Code Quality & TypeScript", "code quality", "code quality typescript");
registerAliases("Testing", "tests", "test coverage");
registerAliases("Performance & Optimization", "performance", "performance optimization");
registerAliases("Logic & Error Handling", "logic", "error handling", "logic error handling");
registerAliases("Lessons Learned Compliance", "lessons learned", "lessons");

function resolveCanonicalName(name: string): (typeof REQUIRED_CRITERIA)[number] | null {
  const trimmed = name.trim();
  if ((REQUIRED_CRITERIA as readonly string[]).includes(trimmed)) {
    return trimmed as (typeof REQUIRED_CRITERIA)[number];
  }

  const key = normalizeCriterionKey(trimmed);
  if (CRITERION_ALIASES[key]) {
    return CRITERION_ALIASES[key];
  }

  for (const canonical of REQUIRED_CRITERIA) {
    if (normalizeCriterionKey(canonical) === key) {
      return canonical;
    }
  }

  return null;
}

/**
 * Map criteria to canonical REQUIRED_CRITERIA by name (with aliases).
 * Fails closed when names cannot be uniquely resolved — reordering is not silently accepted.
 */
export function mapCriteriaByName(criteria: CriterionReview[]): CriterionReview[] {
  const mapped = new Map<string, CriterionReview>();

  for (const criterion of criteria) {
    const canonical = resolveCanonicalName(criterion.name);
    if (!canonical) {
      throw new CriteriaMappingError(`Could not map criterion "${criterion.name}" to a canonical name`);
    }
    if (mapped.has(canonical)) {
      throw new CriteriaMappingError(`Duplicate criterion mapping for "${canonical}"`);
    }
    mapped.set(canonical, { ...criterion, name: canonical });
  }

  if (mapped.size !== REQUIRED_CRITERIA.length) {
    const missing = REQUIRED_CRITERIA.filter((name) => !mapped.has(name));
    throw new CriteriaMappingError(
      `Could not map all criteria to canonical names. Missing: ${missing.join(", ")}`,
    );
  }

  return REQUIRED_CRITERIA.map((name) => mapped.get(name)!);
}

/**
 * Normalize paraphrased criterion names before schema validation.
 * LLMs often shorten names (e.g. "Security" vs "Security & Validation").
 */
export function normalizeCriteriaNames(data: unknown): unknown {
  if (
    typeof data === "object" &&
    data !== null &&
    "criteria" in data &&
    Array.isArray((data as { criteria: unknown }).criteria) &&
    (data as { criteria: unknown[] }).criteria.length === REQUIRED_CRITERIA.length
  ) {
    const review = data as { criteria: CriterionReview[] };
    return {
      ...review,
      criteria: mapCriteriaByName(review.criteria),
    };
  }
  return data;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/**
 * Map alternate LLM finding shapes (file/line/message) to canonical location/issue/fix.
 */
export function normalizeFinding(raw: Record<string, unknown>): Record<string, unknown> {
  const file = asNonEmptyString(raw.file) ?? asNonEmptyString(raw.path);
  const line = asNonEmptyString(raw.line);

  const location =
    asNonEmptyString(raw.location) ??
    (file && line ? `${file}:${line}` : file) ??
    "unknown";

  const issue =
    asNonEmptyString(raw.issue) ??
    asNonEmptyString(raw.message) ??
    asNonEmptyString(raw.description) ??
    asNonEmptyString(raw.summary) ??
    "No description provided";

  const fix =
    asNonEmptyString(raw.fix) ??
    asNonEmptyString(raw.suggestion) ??
    asNonEmptyString(raw.recommendation) ??
    asNonEmptyString(raw.remediation) ??
    "Review the issue and apply an appropriate fix.";

  return {
    severity: raw.severity,
    location,
    issue,
    fix,
  };
}

/**
 * Normalize finding field names across all criteria before schema validation.
 */
export function normalizeFindings(data: unknown): unknown {
  if (typeof data !== "object" || data === null || !("criteria" in data)) {
    return data;
  }

  const review = data as { criteria?: unknown[]; [key: string]: unknown };
  if (!Array.isArray(review.criteria)) {
    return data;
  }

  return {
    ...review,
    criteria: review.criteria.map((criterion) => {
      if (typeof criterion !== "object" || criterion === null) {
        return criterion;
      }

      const entry = criterion as Record<string, unknown>;
      if (!Array.isArray(entry.findings)) {
        return criterion;
      }

      return {
        ...entry,
        findings: entry.findings.map((finding) =>
          typeof finding === "object" && finding !== null
            ? normalizeFinding(finding as Record<string, unknown>)
            : finding,
        ),
      };
    }),
  };
}

/** Normalize LLM output aliases before Zod validation. */
export function normalizeReviewData(data: unknown): unknown {
  return normalizeCriteriaNames(normalizeFindings(data));
}

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

/**
 * Recompute criterion and overall verdicts from findings (don't trust LLM).
 */
export function applyComputedVerdicts(review: ReviewOutput): ReviewOutput {
  const computedCriteria = review.criteria.map((criterion) => ({
    ...criterion,
    verdict: computeCriterionVerdict(criterion.findings),
  }));

  return {
    ...review,
    overall_verdict: computeOverallVerdict(computedCriteria),
    criteria: computedCriteria,
    questions: review.questions ?? [],
  };
}
