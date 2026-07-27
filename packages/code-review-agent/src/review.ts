/* eslint-disable no-console -- CLI status/errors go to stderr/stdout */
import { Agent, CursorAgentError } from "@cursor/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadReviewEnvFile } from "./env.js";
import { assertRefsExist, getDiff, getDiffStat, getWorkingTreeStatus, isDiffEmpty, resolveBaseRef } from "./git.js";
import { buildReviewPrompt } from "./prompt.js";
import { ReviewOutputSchema, type ReviewOutput, computeCriterionVerdict, computeOverallVerdict } from "./review-schema.js";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = resolve(packageDir, "../..");

// Only CURSOR_* / REVIEW_* — never bulk-load app secrets from .env / .dev.vars.
// Shell exports still win (load skips keys already set).
loadReviewEnvFile(resolve(repoRoot, ".env"));
loadReviewEnvFile(resolve(repoRoot, ".dev.vars"));

function usage(): never {
  console.error(`Usage:
  npm run review -- [--base <ref>] [--head <ref>]

Defaults:
  --base  origin/main (fallback either way: origin/main ↔ main)
  --head  HEAD

Requires:
  CURSOR_API_KEY
  Node.js >= 22.13
  One-time: npm run review:install (from repo root)

Note: the agent run is silent until the model starts streaming text — often 30–120s.
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { baseRef: string; headRef: string } {
  let baseRef = process.env.REVIEW_BASE ?? "origin/main";
  let headRef = process.env.REVIEW_HEAD ?? "HEAD";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage();
    if (arg === "--base") {
      baseRef = argv[++i] ?? usage();
      continue;
    }
    if (arg === "--head") {
      headRef = argv[++i] ?? usage();
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
  }

  return { baseRef, headRef };
}

/**
 * Reads context/foundation/lessons.md from repo root.
 * Returns content truncated to 4000 chars or empty string if file doesn't exist.
 * Prevents token bloat as lessons accumulate over time.
 */
function loadLessons(repoRoot: string): string {
  try {
    const lessonsPath = resolve(repoRoot, "context/foundation/lessons.md");
    const content = readFileSync(lessonsPath, "utf8");
    const MAX_LESSONS_CHARS = 4000;
    
    if (content.length <= MAX_LESSONS_CHARS) {
      return content;
    }
    
    // Truncate and add note
    const truncated = content.slice(0, MAX_LESSONS_CHARS);
    return truncated + `\n\n... (truncated at ${MAX_LESSONS_CHARS} chars; review full file for complete history)`;
  } catch {
    // lessons.md is optional; return empty string if missing
    return "";
  }
}

/**
 * Render structured review output to human-readable markdown.
 * Does NOT include top-level header - workflow adds that.
 * Just renders Summary and Findings sections.
 * Exported for testing.
 */
export function renderMarkdown(review: ReviewOutput): string {
  const lines: string[] = [];

  // Summary (no top-level header)
  lines.push(`### Summary\n\n${review.summary}\n`);

  // Findings by criterion
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

  // Questions
  if (review.questions && review.questions.length > 0) {
    lines.push("\n### Questions\n");
    for (const question of review.questions) {
      lines.push(`- ${question}\n`);
    }
  }

  return lines.join("");
}

/**
 * Extract and parse JSON from agent response.
 * Handles preamble text and markdown code blocks.
 * Exported for testing.
 */
export function parseReviewResponse(fullResponse: string): unknown {
  let jsonStr = fullResponse.trim();
  
  // First, try to extract from markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  
  // Find first { and last } to extract pure JSON (handles preamble text)
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('No valid JSON object found in response');
  }
  
  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  
  return JSON.parse(jsonStr);
}

async function main(): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing CURSOR_API_KEY. Set it in the shell, or add CURSOR_API_KEY=... to repo-root .env / .dev.vars (only that key is read from those files).",
    );
    process.exit(1);
  }

  const parsed = parseArgs(process.argv.slice(2));
  let baseRef: string;
  try {
    baseRef = resolveBaseRef(repoRoot, parsed.baseRef);
    assertRefsExist(repoRoot, baseRef, parsed.headRef);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const headRef = parsed.headRef;

  if (isDiffEmpty(repoRoot, baseRef, headRef)) {
    console.error(`[code-review-agent] No changes in ${baseRef}...${headRef}. Nothing to review.`);
    
    // Write minimal valid JSON for workflow (PASS with no findings)
    const emptyReview: ReviewOutput = {
      overall_verdict: "PASS",
      summary: `No changes between ${baseRef} and ${headRef}`,
      criteria: [
        { name: "Stack Conventions (Astro + React + Cloudflare)", verdict: "PASS", findings: [] },
        { name: "Tailwind Class Handling", verdict: "PASS", findings: [] },
        { name: "Supabase Patterns", verdict: "PASS", findings: [] },
        { name: "Cloudflare Workers CPU Constraint", verdict: "PASS", findings: [] },
        { name: "Security & Validation", verdict: "PASS", findings: [] },
        { name: "Code Quality & TypeScript", verdict: "PASS", findings: [] },
        { name: "Testing", verdict: "PASS", findings: [] },
        { name: "Performance & Optimization", verdict: "PASS", findings: [] },
        { name: "Logic & Error Handling", verdict: "PASS", findings: [] },
        { name: "Lessons Learned Compliance", verdict: "PASS", findings: [] },
      ],
      questions: [],
    };
    
    const jsonPath = resolve(repoRoot, "review-output.json");
    writeFileSync(jsonPath, JSON.stringify(emptyReview, null, 2), "utf8");
    console.error(`[code-review-agent] Saved empty review to ${jsonPath}`);
    
    process.exit(0);
  }

  // Precompute diff to inject into prompt (avoid agent running git commands).
  console.error(`[code-review-agent] computing diff...`);
  const diffStat = getDiffStat(repoRoot, baseRef, headRef);
  const diffResult = getDiff(repoRoot, baseRef, headRef);

  if (diffResult.truncated) {
    const sizeKb = Math.round(diffResult.maxBytes / 1024);
    console.error(`[code-review-agent] WARNING: Diff truncated at ${sizeKb}KB. Agent will read files for full context.`);
  }

  // Load lessons.md for historical anti-patterns
  const lessons = loadLessons(repoRoot);

  const modelId = process.env.CURSOR_MODEL?.trim() ?? "composer-2.5";
  const prompt = buildReviewPrompt({
    baseRef,
    headRef,
    diffStat,
    diff: diffResult.diff,
    truncated: diffResult.truncated,
    lessons,
  });

  console.error(`[code-review-agent] cwd=${repoRoot}`);
  console.error(`[code-review-agent] model=${modelId} range=${baseRef}...${headRef}`);
  console.error(`[code-review-agent] starting local agent (may take 1–2 min before first output)…`);

  // Snapshot working tree before agent run to detect any modifications.
  const statusBefore = getWorkingTreeStatus(repoRoot);
  let agentStarted = false;

  let exitCode = 0;

  try {
    await using agent = await Agent.create({
      apiKey,
      model: { id: modelId },
      name: "plant-it-code-review",
      local: {
        cwd: repoRoot,
        // Inline config only — do not pull ambient Cursor IDE settings into CI/scripts.
        settingSources: [],
        // Best-effort gate for shell/MCP/fetch; not a hard security boundary.
        autoReview: true,
      },
    });

    agentStarted = true;
    const run = await agent.send(prompt);
    console.error(`[code-review-agent] run=${run.id} agent=${agent.agentId}`);

    // Collect full response for JSON parsing
    let fullResponse = "";
    
    for await (const event of run.stream()) {
      if (event.type !== "assistant") continue;
      for (const block of event.message.content) {
        if (block.type === "text") {
          fullResponse += block.text;
          // Still show progress to stderr for local runs
          process.stderr.write(".");
        }
      }
    }

    const result = await run.wait();
    console.error(`\n[code-review-agent] status=${result.status}`);

    if (result.status === "error") {
      console.error(result.error?.message ?? "Run failed");
      exitCode = 2;
    } else if (result.status === "cancelled") {
      console.error("Run cancelled");
      exitCode = 2;
    } else {
      // Parse and validate JSON response
      try {
        const parsed = parseReviewResponse(fullResponse);
        let review = ReviewOutputSchema.parse(parsed);

        // Compute verdicts from findings (don't trust LLM)
        const computedCriteria = review.criteria.map((criterion) => {
          const computedVerdict = computeCriterionVerdict(criterion.findings);
          if (computedVerdict !== criterion.verdict) {
            console.error(
              `[code-review-agent] Verdict mismatch for "${criterion.name}": ` +
              `LLM said ${criterion.verdict}, computed ${computedVerdict} from findings`
            );
          }
          return { ...criterion, verdict: computedVerdict };
        });

        const computedOverallVerdict = computeOverallVerdict(computedCriteria);
        if (computedOverallVerdict !== review.overall_verdict) {
          console.error(
            `[code-review-agent] Overall verdict mismatch: ` +
            `LLM said ${review.overall_verdict}, computed ${computedOverallVerdict} from findings`
          );
        }

        // Replace with computed verdicts and normalize questions
        review = {
          ...review,
          overall_verdict: computedOverallVerdict,
          criteria: computedCriteria,
          questions: review.questions ?? [],
        };

        // Save raw JSON for workflow
        const jsonPath = resolve(repoRoot, "review-output.json");
        writeFileSync(jsonPath, JSON.stringify(review, null, 2), "utf8");
        console.error(`[code-review-agent] Saved structured output to ${jsonPath}`);

        // Render and output markdown for humans
        const markdown = renderMarkdown(review);
        console.log(markdown);

        // Set exit code based on verdict
        // Note: exitCode stays 0 even for FAIL verdict - this is advisory review
        // Workflow can decide whether to block based on verdict
        if (review.overall_verdict === "FAIL") {
          console.error(`[code-review-agent] Overall verdict: FAIL (advisory only)`);
        } else {
          console.error(`[code-review-agent] Overall verdict: PASS`);
        }
      } catch (err) {
        console.error("[code-review-agent] Failed to parse structured output:");
        console.error(err);
        console.error("\nRaw response:");
        console.error(fullResponse.slice(0, 1000)); // Show first 1KB for debugging
        exitCode = 2;
      }
    }
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`Startup failed: ${err.message} (retryable=${String(err.isRetryable)})`);
      exitCode = 1;
    } else {
      // Unexpected error; log and exit 1 after finally runs.
      console.error("Unexpected error:", err);
      exitCode = 1;
    }
  } finally {
    // Safety check: ensure agent did not modify working tree.
    // Only check if agent was started (skip if creation failed before any tool access).
    if (agentStarted) {
      const statusAfter = getWorkingTreeStatus(repoRoot);
      if (statusBefore !== statusAfter) {
        console.error("[code-review-agent] ERROR: Working tree was modified during review run!");
        console.error("Before:");
        console.error(statusBefore || "(clean)");
        console.error("After:");
        console.error(statusAfter);
        // Tree modification is more critical than run error/cancel; always use exit 3.
        exitCode = 3;
      }
    }
  }

  process.exit(exitCode);
}

// Only run main() when this file is executed directly (not when imported)
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
