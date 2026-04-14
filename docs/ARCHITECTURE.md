# Architecture

## Goal

The extension is designed to make source code easier to read by combining:

- local heuristics
- workspace glossary caching
- optional retrieval from imported knowledge
- official docs sync for active languages
- token-level preprocessing, prebuild, and caching for repeated symbol explanations
- optional remote model calls
- runtime logging that is visible in VS Code

## Main Modules

### `src/extension.ts`

- registers commands
- manages selection listeners
- keeps the panel synced with the current editor selection
- builds explanation requests
- coordinates glossary refresh, workspace index generation, official docs sync, token cache lookup, token prebuild, onboarding, and follow-up chat
- logs execution flow and provider fallbacks

### `src/analysis/`

- `glossary.ts`: extracts symbols and generates stable term meanings
- `summary.ts`: infers granularity, builds local summaries, and suggests follow-up questions

### `src/providers/`

- `localProvider.ts`: zero-dependency local explanation engine
- `openAICompatibleProvider.ts`: remote adapter for chat completion APIs
- `createProvider.ts`: selects the best provider from settings

### `src/knowledge/`

- `knowledgeStore.ts`: imports `.md`, `.txt`, and `.json` documents, stores them in workspace cache, and retrieves top keyword matches
- `officialDocs.ts`: downloads preset official/reference language documents and chunks them into the knowledge library
- `tokenKnowledgeStore.ts`: stores successful token-level explanations so repeated symbol lookups can avoid repeated model calls
- `tokenKnowledgeBuilder.ts`: turns synced knowledge plus remote reasoning into reusable token entries

### `src/logging/`

- `logger.ts`: writes runtime diagnostics to the `Read Code In Chinese` output channel and mirrors them to the extension host console

### `src/storage/`

- defines workspace cache paths
- persists glossary data, knowledge library, and workspace index reports

### `src/ui/`

- `glossaryTreeProvider.ts`: Explorer sidebar glossary
- `explanationPanel.ts`: explanation, selection metadata, glossary snapshot, workspace preview, and follow-up chat
- `settingsPanel.ts`: first-run onboarding, provider controls, token prebuild trigger, and editable prompt / hyperparameter controls

## Data Flow

1. User selects code or runs a file/workspace command
2. Extension loads settings, logger, and workspace services
3. Settings resolution prefers explicit VS Code configuration, then falls back to environment variables for development-host testing
4. If the panel is open, selection changes automatically trigger explanation refresh
5. Glossary cache is loaded or regenerated
6. Knowledge snippets are retrieved from imported or synced documents
7. If the selection is a token, the extension checks the token knowledge cache before calling the model
8. On token cache miss, the extension first tries to prebuild a reusable token entry from synced knowledge and remote reasoning
9. Explanation request is built with user goal, custom prompt instructions, and provider hyperparameters
10. Local or remote provider returns a structured explanation
11. Successful token explanations can be written into the token knowledge cache
12. Official docs sync can immediately warm token knowledge for the active language
13. Panel, glossary UI, and status metadata update
14. User may ask a follow-up question in the same panel and adjust reasoning effort from the UI
15. If the remote provider fails, the local provider becomes the fallback path and the logger records the failure

## Cache Layout

Workspace-local cache directory:

```text
.read-code-in-chinese/
  glossary/
  knowledge/
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
- VS Code-native, low-noise UI
- faster repeated token explanations through knowledge-grounded preprocessing and caching
