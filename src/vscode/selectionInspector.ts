import * as vscode from "vscode";
import { analyzeSelectionInsight } from "../analysis/selectionInsight";
import {
  ExplanationGranularity,
  GlossaryEntry,
  SelectionInsight
} from "../contracts";

const HOVER_TIMEOUT_MS = 900;

export async function inspectEditorSelection(
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  selectedText: string,
  selectionPreview: string,
  granularity: ExplanationGranularity,
  glossaryEntries: GlossaryEntry[]
): Promise<SelectionInsight | undefined> {
  const selectedPathOffset = selectedText.trim().lastIndexOf(".") + 1;
  const hoverPosition =
    selection.start.line === selection.end.line && selectedPathOffset > 0
      ? selection.start.translate(0, selectedPathOffset)
      : selection.start;
  const [hoverText, originHint] = await Promise.all([
    readHoverText(editor.document.uri, hoverPosition),
    readDefinitionOrigin(editor.document.uri, hoverPosition)
  ]);

  return analyzeSelectionInsight({
    languageId: editor.document.languageId,
    sourceCode: editor.document.getText(),
    selectedText,
    selectionPreview,
    granularity,
    glossaryEntries,
    hoverText,
    originHint
  });
}

async function readDefinitionOrigin(
  uri: vscode.Uri,
  position: vscode.Position
): Promise<SelectionInsight["origin"] | undefined> {
  try {
    const definitions = await withTimeout(
      vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        "vscode.executeDefinitionProvider",
        uri,
        position
      ),
      HOVER_TIMEOUT_MS
    );

    if (!definitions?.length) {
      return undefined;
    }

    const targetUris = definitions.map((definition) =>
      "targetUri" in definition ? definition.targetUri : definition.uri
    );

    if (targetUris.some((targetUri) => vscode.workspace.getWorkspaceFolder(targetUri))) {
      return "local";
    }

    return targetUris.some((targetUri) => targetUri.scheme !== "untitled")
      ? "library"
      : undefined;
  } catch {
    return undefined;
  }
}

async function readHoverText(
  uri: vscode.Uri,
  position: vscode.Position
): Promise<string | undefined> {
  try {
    const hovers = await withTimeout(
      vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        uri,
        position
      ),
      HOVER_TIMEOUT_MS
    );

    return flattenHoverContents(hovers);
  } catch {
    return undefined;
  }
}

async function withTimeout<T>(
  promise: Thenable<T>,
  timeoutMs: number
): Promise<T | undefined> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function flattenHoverContents(hovers: vscode.Hover[] | undefined): string | undefined {
  const parts: string[] = [];

  for (const hover of hovers ?? []) {
    for (const content of hover.contents) {
      if (typeof content === "string") {
        parts.push(content);
      } else if ("value" in content) {
        parts.push(content.value);
      }
    }
  }

  const value = parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
  return value || undefined;
}
