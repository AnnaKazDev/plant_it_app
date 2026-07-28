/**
 * Resolve validation exit code with fail-closed semantics.
 * The validate step runs only when review exit code is 0; a missing output then means failure.
 */
export function resolveValidationExitCode(exitCode: string, validationExitCode: string): string {
  if (exitCode === "0" && !validationExitCode) {
    return "1";
  }
  return validationExitCode || "0";
}
