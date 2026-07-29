export const REVIEW_FAILURE_FILENAME = "review-failure.txt";

export interface FailureReportInput {
  reason: string;
  rawResponse?: string;
  details?: string;
}

const NPM_NOISE_PATTERNS = [
  /^> .+@.+/,
  /^npm run /,
  /^(> )?tsx src\//,
];

const PR_FAILURE_CONTENT_MAX_LEN = 2048;

const SECRET_LINE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|credential)\s*[:=]\s*.+/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /SUPABASE_[A-Z_]+=/,
  /CURSOR_API_KEY/,
  /bearer\s+[a-zA-Z0-9._-]+/i,
];

/** Format Zod issue arrays into a short PR-safe summary. */
export function formatValidationDetails(details: string): string {
  const trimmed = details.trim();
  if (!trimmed.startsWith("[")) {
    return truncateForPr(trimmed, 800);
  }

  try {
    const issues = JSON.parse(trimmed) as Array<{
      path?: unknown[];
      message?: string;
    }>;

    if (!Array.isArray(issues) || issues.length === 0) {
      return truncateForPr(trimmed, 800);
    }

    const bullets = issues.slice(0, 5).map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.join(".") : "unknown";
      return `- \`${path}\`: ${issue.message ?? "invalid value"}`;
    });

    const hint =
      issues.some(
        (issue) =>
          Array.isArray(issue.path) &&
          (issue.path.includes("location") ||
            issue.path.includes("issue") ||
            issue.path.includes("fix")),
      )
        ? "\n\n**Hint:** Agent may have used `file`/`line`/`message` instead of required `location`/`issue`/`fix` on findings."
        : "";

    const more =
      issues.length > 5 ? `\n- ... and ${issues.length - 5} more schema errors` : "";

    return `Schema validation failed (${issues.length} issues):\n\n${bullets.join("\n")}${more}${hint}`;
  } catch {
    return truncateForPr(trimmed, 800);
  }
}

export function truncateForPr(text: string, maxLen = PR_FAILURE_CONTENT_MAX_LEN): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen)}\n\n... (truncated — see workflow logs for full output)`;
}

export function redactSensitiveLines(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      SECRET_LINE_PATTERNS.some((pattern) => pattern.test(line)) ? "[redacted]" : line,
    )
    .join("\n");
}

export function stripRawAgentResponseSection(text: string): string {
  const marker = "### Raw agent response";
  const idx = text.indexOf(marker);
  if (idx === -1) {
    return text.trim();
  }
  return text.slice(0, idx).trim();
}

export function sanitizePrFailureContent(text: string): string {
  return truncateForPr(
    redactSensitiveLines(stripRawAgentResponseSection(stripNpmNoise(text))),
  );
}

/** Human-readable markdown for PR comments when the review agent fails. */
export function formatFailureReport(input: FailureReportInput): string {
  const lines: string[] = ["### Review agent error\n", `**Reason:** ${input.reason}\n`];

  if (input.details?.trim()) {
    lines.push(`\n**Details:** ${formatValidationDetails(input.details.trim())}\n`);
  }

  lines.push("\n_See workflow logs for full agent output._\n");

  return lines.join("");
}

/** Full failure report for CI logs (includes truncated raw response). */
export function formatFailureLogReport(input: FailureReportInput): string {
  const prReport = formatFailureReport(input);

  if (!input.rawResponse?.trim()) {
    return prReport;
  }

  const body = truncateForPr(input.rawResponse.trim(), 8000);
  return `${prReport}\n### Raw agent response (log only)\n\n\`\`\`\n${body}\n\`\`\`\n`;
}

export function stripNpmNoise(text: string): string {
  return text
    .split("\n")
    .filter((line) => !NPM_NOISE_PATTERNS.some((pattern) => pattern.test(line.trim())))
    .join("\n")
    .trim();
}

/** Pick the most useful text for a failed review comment. */
export function extractUsefulLogContent(...sources: Array<string | null | undefined>): string | null {
  for (const source of sources) {
    if (!source?.trim()) continue;

    const stripped = stripNpmNoise(source);
    if (!stripped) continue;

    if (
      stripped.includes("### Review agent error") ||
      stripped.includes("[code-review-agent]") ||
      stripped.includes('"overall_verdict"') ||
      stripped.includes('"criteria"')
    ) {
      return sanitizePrFailureContent(stripped);
    }
  }

  const joined = sources
    .map((source) => (source ? stripNpmNoise(source) : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return joined ? sanitizePrFailureContent(joined) : null;
}
