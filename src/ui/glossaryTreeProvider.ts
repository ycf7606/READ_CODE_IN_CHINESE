import * as vscode from "vscode";
import { GlossaryEntry } from "../contracts";

class GlossaryTreeItem extends vscode.TreeItem {
  constructor(entry: GlossaryEntry) {
    super(entry.term, vscode.TreeItemCollapsibleState.None);
    this.description = entry.category;
    this.tooltip = `${entry.term}: ${entry.meaning}`;
    this.command = {
      command: "readCodeInChinese.editGlossaryEntry",
      title: "Edit Glossary Entry",
      arguments: [entry]
    };
  }
}

export class GlossaryTreeProvider
  implements vscode.TreeDataProvider<GlossaryTreeItem>
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<GlossaryTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private entries: GlossaryEntry[] = [];

  setEntries(entries: GlossaryEntry[]): void {
    this.entries = entries;
    this.onDidChangeTreeDataEmitter.fire();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: GlossaryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<GlossaryTreeItem[]> {
    return this.entries.map((entry) => new GlossaryTreeItem(entry));
  }
}
