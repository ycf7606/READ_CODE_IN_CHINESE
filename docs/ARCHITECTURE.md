# Architecture

## Goal

The extension is designed to make source code easier to read by combining:

- local heuristics
- workspace glossary caching
- optional retrieval from imported knowledge
- optional remote model calls

## Main Modules

### `src/extension.ts`

- registers commands
- manages selection listeners
- builds explanation requests
- coordinates glossary refresh, workspace index generation, and follow-up chat

### `src/analysis/`

- `glossary.ts`: extracts symbols and generates stable term meanings
- `summary.ts`: infers granularity and builds local summaries

### `src/providers/`

- `localProvider.ts`: zero-dependency local explanation engine
- `openAICompatibleProvider.ts`: remote adapter for chat completion APIs
- `createProvider.ts`: selects the best provider from settings

### `src/knowledge/`

- imports `.md`, `.txt`, and `.json` documents
- stores them in workspace cache
- returns top keyword matches for explanation requests

### `src/storage/`

- defines workspace cache paths
- persists glossary data, knowledge library, and workspace index reports

### `src/ui/`

- `glossaryTreeProvider.ts`: Explorer sidebar glossary
- `explanationPanel.ts`: explanation, suggestions, workspace index preview, and chat

## Data Flow

1. User selects code or runs a file/workspace command
2. Extension loads settings and workspace services
3. Glossary cache is loaded or regenerated
4. Knowledge snippets are retrieved from imported documents
5. Explanation request is built
6. Local or remote provider returns a structured explanation
7. Panel and glossary UI update
8. User may ask a follow-up question in the same panel

## Cache Layout

Workspace-local cache directory:

```text
.read-code-in-chinese/
  glossary/
  knowledge/
  reports/
  workspace-index.json
```

## Design Priorities

- fast first response
- consistent terminology
- compact structured explanations
- workspace-local persistence
- minimal assumptions about the user's model provider
