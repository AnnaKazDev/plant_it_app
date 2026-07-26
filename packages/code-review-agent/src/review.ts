/* eslint-disable no-console -- CLI status/errors go to stderr/stdout */
import { Agent, CursorAgentError } from "@cursor/sdk";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRefsExist, isDiffEmpty, resolveBaseRef } from "./git.js";
import { buildReviewPrompt } from "./prompt.js";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = resolve(packageDir, "../..");

// Load secrets from repo root (shell export still wins over file values).
loadEnv({ path: resolve(repoRoot, ".env"), quiet: true });
loadEnv({ path: resolve(repoRoot, ".dev.vars"), override: false, quiet: true });

function usage(): never {
  console.error(`Usage:
  npm run review -- [--base <ref>] [--head <ref>]

Defaults:
  --base  origin/main (fallback: main)
  --head  HEAD

Requires:
  CURSOR_API_KEY
  Node.js >= 22.13

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

async function main(): Promise<void> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing CURSOR_API_KEY. Set it in the shell, or add CURSOR_API_KEY=... to repo-root .env / .dev.vars (gitignored).",
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
    process.exit(0);
  }

  const modelId = process.env.CURSOR_MODEL?.trim() ?? "composer-2.5";
  const prompt = buildReviewPrompt({ baseRef, headRef });

  console.error(`[code-review-agent] cwd=${repoRoot}`);
  console.error(`[code-review-agent] model=${modelId} range=${baseRef}...${headRef}`);
  console.error(`[code-review-agent] starting local agent (may take 1–2 min before first output)…`);

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

    const run = await agent.send(prompt);
    console.error(`[code-review-agent] run=${run.id} agent=${agent.agentId}`);

    for await (const event of run.stream()) {
      if (event.type !== "assistant") continue;
      for (const block of event.message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    }

    const result = await run.wait();
    console.error(`\n[code-review-agent] status=${result.status}`);

    if (result.status === "error") {
      console.error(result.error?.message ?? "Run failed");
      process.exit(2);
    }

    if (result.status === "cancelled") {
      console.error("Run cancelled");
      process.exit(2);
    }

    // Ensure trailing newline after streamed body.
    process.stdout.write("\n");
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`Startup failed: ${err.message} (retryable=${String(err.isRetryable)})`);
      process.exit(1);
    }
    throw err;
  }
}

await main();
