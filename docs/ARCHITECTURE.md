# Architecture

## Runtime Shape

The extension is centered around one runtime coordinator:

- `src/extension.ts`: registers VS Code commands, reacts to editor changes, builds requests, coordinates caches, and updates the panel

Everything else is deliberately split by responsibility:

- `src/analysis/`: static source analysis used before any provider call
- `src/providers/`: explanation backends
- `src/knowledge/`: retrieval, preprocess cache, token cache, official docs sync
- `src/storage/`: workspace-local persistence
- `src/ui/`: webview panels and explorer tree
- `src/logging/`: output-channel logging

## Core Flow

1. User selects code or runs a command.
2. `extension.ts` loads workspace context and settings.
3. The glossary cache is read or regenerated for the current file.
4. Imported knowledge snippets are retrieved.
5. If the selection is a token, the file preprocess cache is checked first.
6. On preprocess miss, the compatibility token cache is checked.
7. The active provider returns a structured explanation or follow-up answer.
8. In parallel or on demand, the file wordbook can be built from full-file symbol candidates.

## Wordbook Pipeline

Implemented in [symbolPreprocessBuilder.ts](/D:/project/代码翻译/READ_CODE_IN_CHINESE/src/knowledge/symbolPreprocessBuilder.ts).

Current default behavior:

- build the raw candidate pool from the active file glossary
- include custom arrow functions, function expressions, object methods, and class methods in that pool
- preprocess all file-local candidates unless `preprocess.includeAllCandidates = false`
- expose the selected wordbook terms before chunk preprocessing starts
- send full-file context to the remote provider in chunks
- persist per-term statuses so failed symbols can be retried later
- keep successful entries even when some chunks fail
- record cache metadata:
  - `selectionMode`
  - `selectionSource`
  - `inferenceSource`
  - `verifiedRemoteInference`
  - `candidateStates`

## Provider Model

- `localProvider.ts`: zero-dependency fallback engine
- `openAICompatibleProvider.ts`: remote chat-completions adapter with endpoint failover
- `createProvider.ts`: resolves the active provider from settings

Remote behavior:

- requires `provider.id = openai-compatible`
- supports fallback endpoints from `READ_CODE_IN_CHINESE_PROVIDER_FALLBACKS`
- retries compatible payload variants before failing

## Persistence Layout

```text
.read-code-in-chinese/
  glossary/
  knowledge/
  preprocess/
  token-knowledge/
  reports/
  workspace-index.json
```

## Test Strategy

Primary regression coverage lives in [index.test.ts](/D:/project/代码翻译/READ_CODE_IN_CHINESE/src/test/index.test.ts).

The suite covers:

- glossary extraction
- granularity inference
- wordbook scope paths
- preprocess chunking
- placeholder-cache handling
- remote preprocess normalization
- fallback endpoint retry
- verified remote preprocess smoke behavior
