#!/usr/bin/env node
/**
 * Validate and recompute verdicts for review-output.json.
 * Used by CI workflow to ensure JSON schema compliance.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ReviewOutputSchema, applyComputedVerdicts, normalizeCriteriaNames } from "./review-schema.js";

const jsonPath = process.argv[2] ?? "review-output.json";
const fullPath = resolve(process.cwd(), jsonPath);

try {
  const jsonContent = readFileSync(fullPath, "utf8");
  const parsed = JSON.parse(jsonContent);
  let review = applyComputedVerdicts(
    ReviewOutputSchema.parse(normalizeCriteriaNames(parsed)),
  );

  // Overwrite file with recomputed verdicts
  writeFileSync(fullPath, JSON.stringify(review, null, 2), "utf8");
  
  console.log(`✓ Valid JSON schema (${fullPath})`);
  console.log(`Overall verdict: ${review.overall_verdict}`);
  
  // Exit 0 regardless of verdict - this is just validation, not enforcement
  process.exit(0);
} catch (err) {
  console.error(`✗ Validation failed for ${fullPath}:`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
