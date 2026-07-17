# Module Overview

[English](OVERVIEW.md) · [简体中文](OVERVIEW.zh-CN.md) · [Architecture](../ARCHITECTURE.md)

## Activation and Orchestration

### `src/extension.ts`

Registers commands and editor listeners, creates workspace services, builds explanation requests, updates UI state, and coordinates:

- selection and file explanations;
- glossary refresh and workspace indexing;
- knowledge import and official-document sync;
- file preprocess lookup and builds;
- onboarding, settings, logs, and follow-up chat;
- provider fallback and user-facing error handling.

State that controls source-editor identity, task cancellation, and selection deduplication is delegated to `src/runtime/` so asynchronous behavior remains testable.

## Runtime and Analysis

### `src/runtime/`

`sourceEditorSession.ts` owns the tracked source editor, one active task per workflow, monotonic task versions, cancellation cleanup, selection deduplication, and recent-reading priority scores. It has no VS Code runtime dependency.

### `src/analysis/`

| Module | Responsibility |
| --- | --- |
| `glossary.ts` | Extract symbols, assignments, member calls, and label-like terms |
| `selectionInsight.ts` | Classify symbol kind/origin, resolve Python aliases, compress documentation |
| `preprocessPolicy.ts` | Enforce trigger, trust, size, and exclusion rules |
| `explanationPostprocess.ts` | Attach one concise documentation-evidence section |
| `symbolContext.ts` | Build bounded definition/reference context and hashes |
| `wordbook.ts` | Infer class/function scopes for wordbook grouping |
| `summary.ts` | Infer granularity and build local summaries |

### `src/vscode/`

`selectionInspector.ts` contains hover and definition-provider access. It moves dotted selections to the final member, distinguishes workspace definitions from installed libraries where possible, and bounds lookup latency.

## Providers and Knowledge

### `src/providers/`

- `localProvider.ts`: zero-dependency heuristic explanation engine.
- `openAICompatibleProvider.ts`: remote explanations, follow-ups, prompt-profile generation, candidate selection, and endpoint failover.
- `createProvider.ts`: resolves the effective provider from settings and environment defaults.

### `src/knowledge/`

| Module | Responsibility |
| --- | --- |
| `knowledgeStore.ts` | Import, store, and retrieve workspace documents |
| `officialDocs.ts` | Download and chunk preset reference pages |
| `preprocessStore.ts` | Persist file-scoped wordbook batches |
| `preprocessFingerprint.ts` | Version builders and provider/audience inputs |
| `symbolPreprocessBuilder.ts` | Select, prioritize, process, and reuse file symbols |
| `tokenKnowledgeStore.ts` | Persist identity-safe repeated-token explanations |
| `tokenKnowledgeBuilder.ts` | Retain older token-prebuild compatibility paths |

## UI, Storage, and Logging

### `src/ui/`

- `glossaryTreeProvider.ts`: Explorer glossary and editing.
- `explanationPanel.ts`: explanation/wordbook tabs, selection metadata, safe rendering, progress, scope tree, and follow-up chat.
- `settingsPanel.ts`: onboarding, provider controls, audience settings, preprocessing, prompt generation, and hyperparameters.

### `src/storage/`

Defines workspace cache paths and JSON persistence helpers.

### `src/logging/`

`logger.ts` writes diagnostics to the **Read Code In Chinese** output channel and the Extension Host console.
