import { execFileSync } from "node:child_process";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
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

/** Default base: origin/main, then main. Explicit refs are left unchanged. */
export function resolveBaseRef(cwd: string, requested: string): string {
  if (requested !== "origin/main") {
    return requested;
  }
  if (refExists(cwd, "origin/main")) {
    return "origin/main";
  }
  if (refExists(cwd, "main")) {
    return "main";
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
