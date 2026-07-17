import * as assert from "node:assert/strict";
import * as vscode from "vscode";

const EXTENSION_ID = "ycf7606.read-code-in-chinese";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Extension ${EXTENSION_ID} should be available in the test host.`);
  await extension.activate();

  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    "readCodeInChinese.explainSelection",
    "readCodeInChinese.openConversationPanel",
    "readCodeInChinese.buildTokenKnowledgeForActiveLanguage"
  ]) {
    assert.ok(commands.includes(command), `Expected command to be registered: ${command}`);
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "The extension test workspace should be open.");
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(workspaceFolder.uri, "sample.py")
  );
  const editor = await vscode.window.showTextDocument(document);
  const source = document.getText();
  const firstTerm = "feature_map";
  const secondTerm = "build_feature_map";
  const firstOffset = source.indexOf(`${firstTerm} =`);
  const secondOffset = source.indexOf(secondTerm);
  assert.ok(firstOffset >= 0 && secondOffset >= 0, "Fixture symbols should exist.");

  editor.selection = new vscode.Selection(
    document.positionAt(firstOffset),
    document.positionAt(firstOffset + firstTerm.length)
  );
  await vscode.commands.executeCommand("readCodeInChinese.explainSelection");
  await vscode.commands.executeCommand("readCodeInChinese.openConversationPanel");

  editor.selection = new vscode.Selection(
    document.positionAt(secondOffset),
    document.positionAt(secondOffset + secondTerm.length)
  );
  editor.selection = new vscode.Selection(
    document.positionAt(firstOffset),
    document.positionAt(firstOffset + firstTerm.length)
  );

  await editor.edit((editBuilder) => {
    editBuilder.insert(document.positionAt(document.getText().length), "\n# extension-host-edit");
  });
  await delay(900);

  assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), document.uri.toString());
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
