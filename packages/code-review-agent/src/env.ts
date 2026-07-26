import { parse } from "dotenv";
import { readFileSync } from "node:fs";

/** Only these keys may be copied from repo secret files into process.env. */
const REVIEW_ENV_KEYS = ["CURSOR_API_KEY", "CURSOR_MODEL", "REVIEW_BASE", "REVIEW_HEAD"] as const;

/**
 * Load review-related vars from a dotenv-style file without importing other secrets
 * (e.g. SUPABASE_*). Existing process.env values always win (shell export).
 */
export function loadReviewEnvFile(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return;
    }
    throw err;
  }

  const parsed = parse(raw);
  for (const key of REVIEW_ENV_KEYS) {
    if (process.env[key] !== undefined) continue;
    const value = parsed[key];
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}
