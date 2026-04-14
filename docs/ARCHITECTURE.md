# Architecture

## Goal

The extension is designed to make source code easier to read by combining:

- local heuristics
- workspace glossary caching
- optional retrieval from imported knowledge
- official docs sync for active languages
- file-level symbol preprocessing for repeated single-symbol explanations
- token knowledge fallback for older repeated token lookups
- optional remote model calls
- runtime logging that is visible in VS Code

## Main Modules

### `src/extension.ts`

- registers commands
- manages selection listeners
- keeps the panel synced with the current editor selection
- builds explanation requests
- coordinates glossary refresh, workspace index generation, official docs sync, file preprocess lookup/build, onboarding, and follow-up chat
- cancels stale explain and follow-up tasks when newer user context arrives
- logs execution flow and provider fallbacks

### `src/analysis/`

- `glossary.ts`: extracts symbols, Python assignments, and label-like string terms, then generates stable term meanings
- `summary.ts`: infers granularity, builds local summaries, and suggests follow-up questions

### `src/providers/`

- `localProvider.ts`: zero-dependency local explanation engine
- `openAICompatibleProvider.ts`: remote adapter for chat completion APIs, prompt-profile generation, and preprocess candidate selection
- `createProvider.ts`: selects the best provider from settings

### `src/knowledge/`

- `knowledgeStore.ts`: imports `.md`, `.txt`, and `.json` documents, stores them in workspace cache, and retrieves top keyword matches
- `officialDocs.ts`: downloads preset official/reference language documents and chunks them into the knowledge library
- `preprocessStore.ts`: stores file-scoped batches of user-defined symbol summaries
- `symbolPreprocessBuilder.ts`: builds a raw file candidate pool, asks the provider to select worth-preprocessing terms when available, falls back locally if needed, then sends one full-file batch request and writes the preprocess cache
- `tokenKnowledgeStore.ts`: stores successful token-level explanations as a compatibility fallback cache
- `tokenKnowledgeBuilder.ts`: older token-prebuild helper retained for compatibility paths

### `src/logging/`

- `logger.ts`: writes runtime diagnostics to the `Read Code In Chinese` output channel and mirrors them to the extension host console

### `src/storage/`

- defines workspace cache paths
- persists glossary data, knowledge library, and workspace index reports

### `src/ui/`

- `glossaryTreeProvider.ts`: Explorer sidebar glossary
- `explanationPanel.ts`: explanation, selection metadata, preprocess progress, visible file wordbook, glossary snapshot, workspace preview, and follow-up chat
- `settingsPanel.ts`: first-run onboarding, provider controls, preprocess trigger, occupation presets, provider-backed prompt generation, and editable prompt / hyperparameter controls

## Data Flow

1. User selects code or runs a file/workspace command
2. Extension loads settings, logger, and workspace services
3. Settings resolution prefers explicit VS Code configuration, then falls back to environment variables for development-host testing
4. If the panel is open, selection changes automatically trigger explanation refresh without repeatedly re-revealing the panel
5. Glossary cache is loaded or regenerated
6. Knowledge snippets are retrieved from imported or synced documents
7. If the selection is a token, the extension first checks the active file's preprocess cache
8. On preprocess-cache miss, it checks the older token knowledge cache
9. Explanation request is built with user goal, occupation, professional level, custom prompt instructions, selection-line preview, and provider hyperparameters
10. Settings-panel prompt generation can call the configured provider to synthesize a reusable global prompt from the current user profile
11. Local or remote provider returns a structured explanation grounded in the exact callsite context
12. In the background, the extension first builds a raw candidate pool from the current file glossary and asks the configured provider to choose wordbook terms using full-file context, with `intermediate` acting as the default medium profile
13. If remote selection is unavailable or fails, the extension falls back to local audience-aware filtering
14. It then preprocesses only those selected symbols in one full-file batch using a dedicated wordbook prompt that ignores explanation sections
15. When the user changes selection or editor, stale explain/follow-up tasks are aborted so newer context wins
16. Successful remote token explanations can still be written into the token knowledge cache
17. Panel, glossary UI, visible wordbook, preprocess progress, and status metadata update
18. User may ask a follow-up question in the same panel and adjust reasoning effort from the UI
19. If the remote provider fails, the local provider becomes the fallback path and the logger records the failure

## Cache Layout

Workspace-local cache directory:

```text
.read-code-in-chinese/
  glossary/
  knowledge/
  preprocess/
  token-knowledge/
  reports/
  workspace-index.json
```

## Design Priorities

- fast first response
- consistent terminology
- compact structured explanations
- workspace-local persistence
- minimal assumptions about the user's model provider
- user-configurable prompt instructions and remote hyperparameters
- provider-backed global prompt generation with editable final text
- VS Code-native, low-noise UI
- faster repeated symbol explanations through file-scoped preprocessing and caching
- API-selected wordbook candidates when a remote provider is available, with audience-aware local fallback when it is not
- audience-aware wordbook selection so experts skip overly common symbols while beginners see more guidance
- correctness over stale work by canceling outdated tasks quickly
