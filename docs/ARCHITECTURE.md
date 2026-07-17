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
- workspace-trust enforcement and explicit remote preprocessing policy
- selection semantics and language-service documentation for precise symbol explanations
- runtime logging that is visible in VS Code

## Main Modules

### `src/extension.ts`

- registers commands
- manages selection listeners
- keeps the panel synced with the current source-editor selection even when webview focus moves into the panel
- builds explanation requests
- coordinates glossary refresh, workspace index generation, official docs sync, file preprocess lookup/build, onboarding, and follow-up chat
- delegates source-editor focus, stale-task cancellation, selection deduplication, and reading-priority history to the runtime session controller
- logs execution flow and provider fallbacks

### `src/runtime/`

- `sourceEditorSession.ts`: owns the tracked source editor, one active task per workflow, monotonic task versions, cancellation cleanup, automatic-selection deduplication, and recent-reading priority scores
- keeps stale asynchronous results from writing panel state after the editor, selection, or task context has changed
- remains independent from the VS Code runtime so its lifecycle behavior can be covered by unit tests

### `src/analysis/`

- `glossary.ts`: extracts symbols, Python assignments, and label-like string terms, then generates stable term meanings
- `selectionInsight.ts`: classifies selected variables, functions, types, constants, modules, local symbols, library symbols, and Python built-ins; resolves Python import aliases and compresses hover documentation
- `preprocessPolicy.ts`: decides whether manual/save/idle preprocessing is allowed based on mode, workspace trust, file size, and exclusion globs
- `explanationPostprocess.ts`: attaches one concise documentation-evidence section to library and built-in explanations when a signature or language-service summary is available
- `symbolContext.ts`: builds bounded definition/reference windows, retains long indented/brace scopes, divides global context budgets fairly across candidates, and creates stable per-symbol context hashes
- `wordbook.ts`: infers class/function scope ranges from the active file and annotates visible wordbook entries with scope paths for tree rendering
- `summary.ts`: infers granularity, builds local summaries, and suggests follow-up questions

### `src/vscode/`

- `selectionInspector.ts`: isolates VS Code hover/definition-provider access, moves dotted selections to the final member position, distinguishes workspace definitions from installed libraries, and bounds language-service lookup latency
- keeps VS Code-specific inspection outside the pure selection-analysis module

### `src/providers/`

- `localProvider.ts`: zero-dependency local explanation engine
- `openAICompatibleProvider.ts`: remote adapter for chat completion APIs, prompt-profile generation, and preprocess candidate selection
- `createProvider.ts`: selects the best provider from settings

### `src/knowledge/`

- `knowledgeStore.ts`: imports `.md`, `.txt`, and `.json` documents, stores them in workspace cache, and retrieves top keyword matches
- `officialDocs.ts`: downloads preset official/reference language documents and chunks them into the knowledge library
- `preprocessStore.ts`: stores file-scoped batches of user-defined symbol summaries
- `preprocessFingerprint.ts`: versions preprocessing behavior and fingerprints provider, fallback, model, occupation, professional level, and user goal inputs
- `symbolPreprocessBuilder.ts`: builds a raw file candidate pool, uses local ranking directly for small pools, asks the provider to select worth-preprocessing terms for larger pools, and preprocesses prioritized chunks from bounded symbol context while reusing entries whose context hash is unchanged
- `tokenKnowledgeStore.ts`: stores successful token-level explanations under v2 identity keys that separate qualified APIs and local callsites while retaining read compatibility for legacy term-only entries
- `tokenKnowledgeBuilder.ts`: older token-prebuild helper retained for compatibility paths

### `src/logging/`

- `logger.ts`: writes runtime diagnostics to the `Read Code In Chinese` output channel and mirrors them to the extension host console

### `src/storage/`

- defines workspace cache paths
- persists glossary data, knowledge library, and workspace index reports

### `src/ui/`

- `glossaryTreeProvider.ts`: Explorer sidebar glossary
- `explanationPanel.ts`: compact Chinese explanation and wordbook tabs, symbol kind/origin badges, selection-follow pause/resume, manual regeneration, safe DOM rendering, preprocess progress, scope tree, workspace preview, and follow-up chat
- `settingsPanel.ts`: first-run onboarding, provider controls, preprocess trigger, occupation presets, provider-backed prompt generation, and editable prompt / hyperparameter controls

## Data Flow

1. User selects code or runs a file/workspace command.
2. Extension loads settings, logger, and workspace services.
3. Settings resolution prefers explicit VS Code configuration, then falls back to environment variables for development-host testing.
4. If the remote provider requires a trusted workspace and the workspace is untrusted, explanation and prompt work use the local provider while remote preprocessing is blocked.
5. If the panel is open, selection changes automatically trigger explanation refresh without repeatedly re-revealing the panel.
6. Glossary cache is loaded or regenerated.
7. The selection inspector asks the active language service for bounded hover and definition data, then pure analysis classifies symbol kind and origin.
8. Knowledge snippets are retrieved using selected text, qualified name, signature, and nearby callsite context.
9. Token selections first check a builder/provider/audience-compatible file preprocess cache.
10. On preprocess-cache miss, token knowledge is queried by qualified API or callsite-safe identity rather than plain term text.
11. Explanation requests include symbol insight, user goal, audience profile, custom instructions, selection-line preview, and provider hyperparameters.
12. Settings-panel prompt generation can call the configured provider to synthesize a reusable global prompt from the current user profile.
13. Local or remote providers return structured callsite-grounded explanations; library documentation is attached once as concise evidence.
14. Preprocessing runs only when its explicit mode permits the trigger, then applies trust, exclusion, file-size, and candidate-count policies before provider creation.
15. The extension builds a raw candidate pool and uses local ranking directly when fewer than 24 candidates make a separate remote selection call wasteful.
16. Larger pools may use a remote selection pass over compact definition/reference context, with retention targets of 100% for `beginner`, about 85% for `intermediate`, and about 70% for `expert`.
17. Selected wordbook terms are processed in prioritized chunks of about 20 symbols, with partial cache writes after each chunk.
18. Each batch receives fairly budgeted symbol scopes instead of the entire source file; context hashes are reusable only when the build fingerprint is also compatible.
19. Recent selection activity influences remaining chunk order, so repeatedly read areas are preprocessed earlier.
20. Partial cache writes store only actual generated entries, and legacy placeholder entries are ignored when resuming or reopening a file.
21. Selection, editor, and unsaved document changes abort and invalidate stale work before newer tasks start.
22. Successful remote token explanations can still be written into the identity-safe token knowledge cache.
23. Visible wordbook entries are annotated with scope paths so the panel can group them by classes and functions.
24. Panel and glossary UI update through text-only DOM construction; follow-up controls stay disabled until a current explanation exists.
25. The user may ask follow-up questions in the same panel and adjust reasoning effort from the UI.
26. If the remote provider fails, the local provider becomes the fallback path and the logger records the failure.

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
- accurate variable/function dimensions instead of generic identifier explanations
- side-effect-free Python documentation discovery through the active language service
- bounded preprocessing context and symbol-level cache reuse
- privacy-first manual preprocessing defaults with trust, exclusion, and size gates
- cache identities and build fingerprints that favor correctness over stale reuse
- real Extension Host smoke coverage in addition to pure unit tests
