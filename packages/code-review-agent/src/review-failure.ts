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

/** Human-readable markdown for PR comments when the review agent fails. */
export function formatFailureReport(input: FailureReportInput): string {
  const lines: string[] = ["### Review agent error\n", `**Reason:** ${input.reason}\n`];

  if (input.details?.trim()) {
    lines.push(`\n**Details:** ${input.details.trim()}\n`);
  }

  if (input.rawResponse?.trim()) {
    const trimmed = input.rawResponse.trim();
    const maxLen = 12_000;
    const body =
      trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}\n\n... (truncated)` : trimmed;
    lines.push(`\n### Raw agent response\n\n\`\`\`\n${body}\n\`\`\`\n`);
  }

  return lines.join("");
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
      return stripped;
    }
  }

  const joined = sources
    .map((source) => (source ? stripNpmNoise(source) : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return joined || null;
}
