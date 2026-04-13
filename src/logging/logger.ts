import * as vscode from "vscode";

export class ExtensionLogger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel("Read Code In Chinese");

  info(message: string, details?: unknown): void {
    this.write("INFO", message, details);
  }

  warn(message: string, details?: unknown): void {
    this.write("WARN", message, details);
  }

  error(message: string, details?: unknown): void {
    this.write("ERROR", message, details);
  }

  show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }

  dispose(): void {
    this.channel.dispose();
  }

  private write(level: "INFO" | "WARN" | "ERROR", message: string, details?: unknown): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}${formatDetails(details)}`;

    this.channel.appendLine(line);

    if (level === "ERROR") {
      console.error(`[RCIC] ${line}`);
      return;
    }

    if (level === "WARN") {
      console.warn(`[RCIC] ${line}`);
      return;
    }

    console.info(`[RCIC] ${line}`);
  }
}

function formatDetails(details?: unknown): string {
  if (details === undefined) {
    return "";
  }

  if (details instanceof Error) {
    return ` | ${details.message}${details.stack ? ` | ${details.stack}` : ""}`;
  }

  if (typeof details === "string") {
    return ` | ${details}`;
  }

  try {
    return ` | ${JSON.stringify(details)}`;
  } catch {
    return ` | ${String(details)}`;
  }
}
