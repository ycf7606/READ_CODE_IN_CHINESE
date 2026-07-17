import { ExtensionSettings, PreprocessMode } from "../contracts";

export type PreprocessTrigger = "manual" | "save" | "idle";

export interface PreprocessPolicyInput {
  trigger: PreprocessTrigger;
  mode: PreprocessMode;
  workspaceTrusted: boolean;
  requireTrustedWorkspace: boolean;
  relativeFilePath: string;
  fileBytes: number;
  maxFileBytes: number;
  excludePatterns: string[];
}

export interface PreprocessPolicyDecision {
  allowed: boolean;
  reason?: string;
}

export function evaluatePreprocessPolicy(
  input: PreprocessPolicyInput
): PreprocessPolicyDecision {
  if (input.mode === "off") {
    return { allowed: false, reason: "文件预处理已关闭。" };
  }

  if (!isTriggerAllowed(input.mode, input.trigger)) {
    return {
      allowed: false,
      reason:
        input.mode === "manual"
          ? "文件预处理当前仅允许手动运行。"
          : "文件预处理当前仅在保存时运行。"
    };
  }

  if (input.requireTrustedWorkspace && !input.workspaceTrusted) {
    return { allowed: false, reason: "当前工作区未受信任，已阻止向远端发送源码。" };
  }

  if (input.fileBytes > input.maxFileBytes) {
    return {
      allowed: false,
      reason: `文件大小 ${input.fileBytes} 字节，超过预处理上限 ${input.maxFileBytes} 字节。`
    };
  }

  const matchedPattern = input.excludePatterns.find((pattern) =>
    matchesGlob(input.relativeFilePath, pattern)
  );

  if (matchedPattern) {
    return {
      allowed: false,
      reason: `文件命中预处理排除规则：${matchedPattern}`
    };
  }

  return { allowed: true };
}

export function isPreprocessTriggerEnabled(
  settings: Pick<ExtensionSettings, "preprocessMode">,
  trigger: PreprocessTrigger
): boolean {
  return isTriggerAllowed(settings.preprocessMode, trigger);
}

export function matchesGlob(relativeFilePath: string, pattern: string): boolean {
  const normalizedPath = relativeFilePath.replace(/\\/g, "/");
  const normalizedPattern = pattern.trim().replace(/\\/g, "/");

  if (!normalizedPattern) {
    return false;
  }

  const patterns = normalizedPattern.startsWith("**/")
    ? [normalizedPattern, normalizedPattern.slice(3)]
    : [normalizedPattern];

  return patterns.some((candidatePattern) => {
    const expression = candidatePattern
      .split("**")
      .map((segment) =>
        segment
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, "[^/]")
      )
      .join(".*");

    return new RegExp(`^${expression}$`, "i").test(normalizedPath);
  });
}

function isTriggerAllowed(mode: PreprocessMode, trigger: PreprocessTrigger): boolean {
  if (trigger === "manual") {
    return mode !== "off";
  }

  if (trigger === "save") {
    return mode === "onSave" || mode === "idle";
  }

  return mode === "idle";
}
