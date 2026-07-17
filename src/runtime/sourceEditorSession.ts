export type SourceEditorTaskKind = "explain" | "follow-up" | "preprocess";

export interface SourceEditorTask {
  version: number;
  controller: AbortController;
}

interface TaskSlot {
  version: number;
  active?: SourceEditorTask;
}

const TASK_KINDS: SourceEditorTaskKind[] = ["explain", "follow-up", "preprocess"];

/**
 * Owns the short-lived state associated with the current source-editor session.
 *
 * Keeping this state outside the extension entrypoint makes stale async work,
 * editor focus changes, and selection-driven prioritization follow one lifecycle.
 */
export class SourceEditorSessionController<TEditor> {
  private trackedEditor: TEditor | undefined;
  private lastAutoExplainSignature = "";
  private readonly recentSelectionLinesByFile = new Map<string, number[]>();
  private readonly taskSlots: Record<SourceEditorTaskKind, TaskSlot> = {
    explain: { version: 0 },
    "follow-up": { version: 0 },
    preprocess: { version: 0 }
  };

  constructor(
    initialEditor?: TEditor,
    private readonly recentSelectionLimit = 12
  ) {
    this.trackedEditor = initialEditor;
  }

  trackEditor(editor: TEditor): void {
    this.trackedEditor = editor;
  }

  getPreferredEditor(explicitEditor?: TEditor, activeEditor?: TEditor): TEditor | undefined {
    return explicitEditor ?? activeEditor ?? this.trackedEditor;
  }

  acceptAutoExplainSignature(signature: string): boolean {
    if (signature === this.lastAutoExplainSignature) {
      return false;
    }

    this.lastAutoExplainSignature = signature;
    return true;
  }

  resetAutoExplainSignature(): void {
    this.lastAutoExplainSignature = "";
  }

  startTask(kind: SourceEditorTaskKind): SourceEditorTask {
    const slot = this.taskSlots[kind];
    const previousTask = slot.active;
    slot.active = undefined;
    previousTask?.controller.abort();
    slot.version += 1;
    slot.active = {
      version: slot.version,
      controller: new AbortController()
    };
    return slot.active;
  }

  isTaskCurrent(kind: SourceEditorTaskKind, version: number): boolean {
    return this.taskSlots[kind].active?.version === version;
  }

  finishTask(kind: SourceEditorTaskKind, version: number): boolean {
    const slot = this.taskSlots[kind];

    if (slot.active?.version !== version) {
      return false;
    }

    slot.active = undefined;
    return true;
  }

  cancelTask(kind: SourceEditorTaskKind): SourceEditorTask | undefined {
    const slot = this.taskSlots[kind];
    const task = slot.active;

    if (!task) {
      return undefined;
    }

    slot.active = undefined;
    task.controller.abort();
    return task;
  }

  recordSelectionLine(relativeFilePath: string, sourceLine: number): void {
    const recentLines = this.recentSelectionLinesByFile.get(relativeFilePath) ?? [];
    recentLines.push(sourceLine);

    if (recentLines.length > this.recentSelectionLimit) {
      recentLines.splice(0, recentLines.length - this.recentSelectionLimit);
    }

    this.recentSelectionLinesByFile.set(relativeFilePath, recentLines);
  }

  getSelectionPriorityScore(relativeFilePath: string, sourceLine: number): number {
    const recentLines = this.recentSelectionLinesByFile.get(relativeFilePath) ?? [];

    return recentLines.reduce((score, line, index) => {
      const recencyWeight = index + 1;
      const distance = Math.abs(line - sourceLine);

      if (distance > 24) {
        return score;
      }

      return score + Math.max(0, 25 - distance) * recencyWeight;
    }, 0);
  }

  dispose(): void {
    for (const kind of TASK_KINDS) {
      this.cancelTask(kind);
    }

    this.recentSelectionLinesByFile.clear();
    this.trackedEditor = undefined;
  }
}
