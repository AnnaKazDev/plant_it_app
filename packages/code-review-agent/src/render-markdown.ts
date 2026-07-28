import type { ReviewOutput } from "./review-schema.js";

/**
 * Render structured review output to human-readable markdown.
 * Does NOT include top-level header - workflow adds that.
 */
export function renderMarkdown(review: ReviewOutput): string {
  const lines: string[] = [];

  lines.push(`### Summary\n\n${review.summary}\n`);

  const criteriaWithFindings = review.criteria.filter((c) => c.findings.length > 0);

  if (criteriaWithFindings.length === 0) {
    lines.push("### Findings\n\n✅ No findings. Code looks good.\n");
  } else {
    lines.push("### Findings\n");

    for (const criterion of criteriaWithFindings) {
      lines.push(`\n#### ⭐ ${criterion.name.toUpperCase()}\n`);

      for (const finding of criterion.findings) {
        const severityEmoji = {
          BLOCKER: "🔴",
          MAJOR: "🟡",
          MINOR: "🟢",
          NIT: "⚪",
        }[finding.severity];

        lines.push(`\n**${severityEmoji} ${finding.severity}**\n`);
        lines.push(`**Location:** \`${finding.location}\`\n`);
        lines.push(`\n**Issue:** ${finding.issue}\n`);
        lines.push(`\n**Fix:** ${finding.fix}\n`);
        lines.push("\n---\n");
      }
    }
  }

  if (review.questions && review.questions.length > 0) {
    lines.push("\n### Questions\n");
    for (const question of review.questions) {
      lines.push(`- ${question}\n`);
    }
  }

  return lines.join("");
}
