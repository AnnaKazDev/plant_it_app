import { execFileSync } from "node:child_process";

// 10 MiB buffer for large diffs (10x default 1 MiB).
const MAX_BUFFER = 10 * 1024 * 1024;

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_BUFFER,
  }).trim();
}

export function refExists(cwd: string, ref: string): boolean {
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_BASE_CANDIDATES = ["origin/main", "main"] as const;

/**
 * Resolve a base ref. For the symbolic defaults `origin/main` / `main`, try both
 * (preferring the requested spelling first). Other refs are left unchanged.
 */
export function resolveBaseRef(cwd: string, requested: string): string {
  const isDefaultBase = (DEFAULT_BASE_CANDIDATES as readonly string[]).includes(requested);
  if (!isDefaultBase) {
    return requested;
  }

  const ordered = requested === "main" ? (["main", "origin/main"] as const) : (["origin/main", "main"] as const);

  for (const candidate of ordered) {
    if (refExists(cwd, candidate)) {
      return candidate;
    }
  }

  throw new Error("Neither origin/main nor main exists. Pass --base <ref> or set REVIEW_BASE.");
}

export function assertRefsExist(cwd: string, baseRef: string, headRef: string): void {
  if (!refExists(cwd, baseRef)) {
    throw new Error(`Base ref not found: ${baseRef}`);
  }
  if (!refExists(cwd, headRef)) {
    throw new Error(`Head ref not found: ${headRef}`);
  }
}

/** Returns true when the triple-dot diff is empty. */
export function isDiffEmpty(cwd: string, baseRef: string, headRef: string): boolean {
  try {
    execFileSync("git", ["diff", "--quiet", `${baseRef}...${headRef}`], {
      cwd,
      stdio: ["ignore", "ignore", "pipe"],
    });
    return true;
  } catch (err) {
    // git diff --quiet exits 1 when there are differences.
    if (err && typeof err === "object" && "status" in err && (err as { status: number | null }).status === 1) {
      return false;
    }
    throw err;
  }
}

/**
 * Returns the current working tree status (staged + unstaged changes).
 * Used to detect if an agent run modified files.
 */
export function getWorkingTreeStatus(cwd: string): string {
  return git(cwd, ["status", "--porcelain"]);
}

/**
 * Returns the diff stat summary for the given range.
 */
export function getDiffStat(cwd: string, baseRef: string, headRef: string): string {
  return git(cwd, ["diff", "--stat", `${baseRef}...${headRef}`]);
}

/**
 * Returns the full diff for the given range, capped at maxBytes.
 * Truncates with a warning message if the diff exceeds the limit.
 * Hard limit: diffs larger than MAX_BUFFER (10 MiB) will throw.
 */
export function getDiff(
  cwd: string,
  baseRef: string,
  headRef: string,
  maxBytes = 500_000,
): { diff: string; truncated: boolean; maxBytes: number } {
  const full = git(cwd, ["diff", `${baseRef}...${headRef}`]);
  const buffer = Buffer.from(full, "utf8");

  if (buffer.byteLength <= maxBytes) {
    return { diff: full, truncated: false, maxBytes };
  }

  // Find the last newline before maxBytes to avoid splitting UTF-8 or mid-line.
  let cutIndex = maxBytes;
  while (cutIndex > 0 && buffer[cutIndex] !== 0x0a) {
    cutIndex--;
  }

  // If no newline found in the first maxBytes, fall back to original limit.
  if (cutIndex === 0) {
    cutIndex = maxBytes;
  }

  const truncated = buffer.subarray(0, cutIndex).toString("utf8");
  const marker = "\n\n... (diff truncated — read changed files for full context) ...";

  return { diff: truncated + marker, truncated: true, maxBytes };
}
