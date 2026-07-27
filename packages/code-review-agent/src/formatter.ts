/* eslint-disable no-console -- formatter writes to stdout/stderr */
import pc from "picocolors";
import { resolve } from "node:path";

/**
 * Format a file path with optional line number as a clickable terminal link.
 * Uses OSC 8 escape codes supported by iTerm2, VS Code terminal, Windows Terminal.
 */
export function formatFileLink(repoRoot: string, path: string, line?: number): string {
  const absolutePath = resolve(repoRoot, path);
  const displayText = line ? `${path}:${line}` : path;

  // VS Code format: vscode://file/absolute/path:line
  const fileUrl = `vscode://file/${absolutePath}${line ? `:${line}` : ""}`;

  // OSC 8 hyperlink: \u001B]8;;URL\u001B\\text\u001B]8;;\u001B\\
  const hyperlink = `\u001B]8;;${fileUrl}\u001B\\${displayText}\u001B]8;;\u001B\\`;

  return pc.cyan(hyperlink);
}

/**
 * Format emoji severity markers with colors.
 */
export function formatSeverity(text: string): string {
  if (text.includes("🔴")) {
    return pc.red(pc.bold(text));
  }
  if (text.includes("🟡")) {
    return pc.yellow(pc.bold(text));
  }
  if (text.includes("🟢")) {
    return pc.green(text);
  }
  if (text.includes("⚪")) {
    return pc.gray(text);
  }
  return text;
}

/**
 * Parse and enhance a line of agent output with colors and clickable links.
 */
export function formatLine(repoRoot: string, line: string): string {
  // Section headers (###)
  if (line.startsWith("### ")) {
    return pc.bold(pc.blue(line));
  }

  // Severity markers (🔴/🟡/🟢/⚪)
  if (/^[*]{2}[🔴🟡🟢⚪]/.test(line)) {
    return formatSeverity(line);
  }

  // Location: path/to/file.ts:123
  const locationMatch = line.match(/^[*]{2}Location:[*]{2}\s+`([^`]+)`$/);
  if (locationMatch) {
    const [fullPath, lineNum] = locationMatch[1].split(":");
    const formattedLink = formatFileLink(repoRoot, fullPath, lineNum ? parseInt(lineNum, 10) : undefined);
    return `${pc.bold("Location:")} ${formattedLink}`;
  }

  // Issue: / Fix: headers
  if (line.startsWith("**Issue:**")) {
    return pc.yellow(pc.bold("Issue:")) + line.slice("**Issue:**".length);
  }
  if (line.startsWith("**Fix:**")) {
    return pc.green(pc.bold("Fix:")) + line.slice("**Fix:**".length);
  }

  // Success message
  if (line.includes("✅") && line.includes("No findings")) {
    return pc.green(pc.bold(line));
  }

  // Horizontal rule
  if (line.trim() === "---") {
    return pc.gray("─".repeat(80));
  }

  // Code blocks (already have syntax highlighting in terminal, just dim the fence)
  if (line.startsWith("```")) {
    return pc.dim(line);
  }

  return line;
}

/**
 * Stream agent output with formatting.
 * Buffers by line and applies colors + clickable links.
 */
export class FormattedOutputStream {
  private buffer = "";

  constructor(private readonly repoRoot: string) {}

  write(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");

    // Keep last incomplete line in buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const formatted = formatLine(this.repoRoot, line);
      console.log(formatted);
    }
  }

  flush(): void {
    if (this.buffer) {
      const formatted = formatLine(this.repoRoot, this.buffer);
      console.log(formatted);
      this.buffer = "";
    }
  }
}
