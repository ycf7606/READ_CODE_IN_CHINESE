# READ_CODE_IN_CHINESE

`READ_CODE_IN_CHINESE` is a VS Code extension for turning source code into concise Chinese explanations while keeping terminology, official reference context, file role, and follow-up questions in one workflow.

## What It Does

- Explain the current selection with a compact structured response
- Distinguish variables, functions, classes, constants, modules, and library symbols before choosing an explanation dimension
- Reuse VS Code language-service hover signatures and documentation for Python library or built-in symbols without importing or executing the package
- Detect multiple granularities:
  - variable / token
  - statement
  - block
  - function
  - current file overview
  - workspace file index
- Maintain a file-level glossary cache and show it in the Explorer sidebar
- Batch-preprocess user-defined file symbols into a reusable file-scoped cache
- Let users edit glossary meanings and re-run explanations
- Support follow-up chat in a side panel
- Import local knowledge documents for retrieval-enhanced explanations
- Sync official language documents into the workspace knowledge library
- Show a first-run settings panel for provider, prompt, and hyperparameter setup
- Keep the panel open, pause or resume selection following, and manually regenerate the current explanation without stealing editor focus
- Write runtime diagnostics into a dedicated VS Code output channel
- Use either:
  - a local heuristic engine
  - an OpenAI-compatible remote provider

## Current Status

- The end-to-end extension workflow is implemented and covered by 41 unit tests plus a real VS Code Extension Host smoke test
- The current stable feature baseline keeps the Stage 19 wordbook scope tree, Stage 29 per-chunk preprocessing fallback, and Stage 30 multi-endpoint remote failover
- Stage 31 moved source-editor focus and asynchronous task lifecycle state into a dedicated controller so stale work cannot overwrite newer panel state
- Stage 32 adds selection-aware variable/function explanations, concise Python API documentation, relevant-context preprocessing, and a hardened Chinese panel interaction flow
- Stage 33 isolates same-name token caches, makes remote preprocessing privacy-first and opt-in, invalidates work on unsaved edits, and adds build fingerprints plus Extension Host coverage
- Tracking board: `docs/project/WORKBOARD.md`

## Main Commands

- `Read Code In Chinese: Explain Selection`
- `Read Code In Chinese: Toggle Auto Explain`
- `Read Code In Chinese: Open Conversation Panel`
- `Read Code In Chinese: Explain Current File`
- `Read Code In Chinese: Generate Workspace Index`
- `Read Code In Chinese: Refresh Glossary`
- `Read Code In Chinese: Import Knowledge Documents`
- `Read Code In Chinese: Sync Official Docs For Active Language`
- `Read Code In Chinese: Preprocess Current File Symbols`
- `Read Code In Chinese: Show Logs`
- `Read Code In Chinese: Open Settings Panel`

## Default Shortcuts

- `Ctrl+Alt+E`: explain current selection
- `Ctrl+Alt+T`: toggle auto explain
- `Ctrl+Alt+F`: explain current file

## Sidebar And Panel

- Explorer sidebar view: `Code Glossary`
- Webview panel:
  - latest explanation
  - active file and selection metadata
  - detected symbol kind, origin, and qualified API name when available
  - loading spinner while remote analysis is running
  - automatic selection watching with explicit pause/resume and regenerate controls
  - immediate cancellation of obsolete explanation and follow-up work when the selection changes
  - inline reasoning-effort selector for follow-up chat
  - settings button that opens the configuration panel
  - preprocess progress with separate candidate-pool, selected-target, cached-entry, and batch counts
  - visible full-file wordbook for the current file preprocess cache
  - compact collapsible wordbook tree grouped by classes, functions, and module scope
  - compact current-file terminology
  - workspace index preview
  - follow-up chat
- Output channel: `Read Code In Chinese`

## Configuration

### Auto Explain

- `readCodeInChinese.autoExplain.enabled`
- `readCodeInChinese.autoExplain.delayMs`
- `readCodeInChinese.ui.autoOpenPanel`

### Provider

- `readCodeInChinese.provider.id`
- `readCodeInChinese.provider.baseUrl`
- `readCodeInChinese.provider.model`
- `readCodeInChinese.provider.apiKeyEnvVar`
- `readCodeInChinese.provider.fallbacks`
- `readCodeInChinese.provider.timeoutMs`
- `readCodeInChinese.provider.temperature`
- `readCodeInChinese.provider.topP`
- `readCodeInChinese.provider.maxTokens`
- `readCodeInChinese.provider.reasoningEffort`
- `readCodeInChinese.provider.requireTrustedWorkspace`

### File Preprocessing

- `readCodeInChinese.preprocess.mode`
- `readCodeInChinese.preprocess.exclude`
- `readCodeInChinese.preprocess.maxFileBytes`
- `readCodeInChinese.preprocess.maxCandidates`

### Explanation Output

- `readCodeInChinese.explanation.detailLevel`
- `readCodeInChinese.explanation.professionalLevel`
- `readCodeInChinese.explanation.occupation`
- `readCodeInChinese.explanation.sections`
- `readCodeInChinese.explanation.userGoal`
- `readCodeInChinese.prompt.customInstructions`

### Knowledge Retrieval

- `readCodeInChinese.knowledge.topK`

## Provider Modes

### Local Mode

Use `readCodeInChinese.provider.id = local`.

This mode:

- works without API keys
- uses local heuristics
- uses imported knowledge snippets when available
- is the safest default for offline development

When `readCodeInChinese.provider.requireTrustedWorkspace` is enabled, an untrusted workspace automatically uses the local provider instead of sending source code to a remote endpoint.

### OpenAI-Compatible Mode

Use `readCodeInChinese.provider.id = openai-compatible` and set:

- `readCodeInChinese.provider.baseUrl`
- `readCodeInChinese.provider.model`
- `readCodeInChinese.provider.temperature`
- `readCodeInChinese.provider.topP`
- `readCodeInChinese.provider.maxTokens`
- environment variable named by `readCodeInChinese.provider.apiKeyEnvVar`

Example in PowerShell:

```powershell
$env:READ_CODE_IN_CHINESE_API_KEY="your-api-key"
```

The settings panel can now edit:

- provider mode
- base URL
- model
- API key environment variable name
- timeout
- occupation
- user goal
- generated global prompt instructions
- sampling controls
- reasoning effort
- auto explain
- workspace trust enforcement
- preprocess mode, exclusions, file-size limit, and candidate limit

It can also:

- generate the global prompt through the configured provider using the current audience and hyperparameter profile
- show prompt-generation status inline before the user saves the final editable prompt

Runtime explanation prompts also inject `occupation` and `professionalLevel` directly, so explanation tone can still adapt even if the editable prompt text is not regenerated after a profile change.

## Knowledge Import

The extension can import local `.md`, `.txt`, and `.json` files as retrieval documents.

- Command: `Read Code In Chinese: Import Knowledge Documents`
- Imported files are stored in the workspace cache under `.read-code-in-chinese/knowledge/`
- Retrieval is keyword-based and is attached to explanation requests

Sample schema:

```json
[
  {
    "title": "fetch API basics",
    "content": "fetch(url) sends an HTTP request and returns a promise.",
    "tags": ["javascript", "http"]
  }
]
```

More detail: `docs/knowledge/IMPORTING_KNOWLEDGE.md`

## File Symbol Preprocessing

When the remote provider is enabled, the extension can preprocess the active file's user-defined variables, functions, classes, types, and string-form labels using compact definition and reference windows.

- Preprocess cache path: `.read-code-in-chinese/preprocess/<file>.json`
- Command: `Read Code In Chinese: Preprocess Current File Symbols`
- The default mode is `manual`; `onSave` and `idle` must be selected explicitly before background remote preprocessing can run
- Untrusted workspaces, oversized files, and paths matching sensitive-file glob rules are rejected before a remote preprocessing request is created
- When a remote provider is enabled and the file has at least 24 candidates, a dedicated API selection pass chooses wordbook terms from a compact relevant-context view using `professionalLevel` and `occupation`
- Smaller candidate pools use fast local ranking and skip the extra remote selection request
- Selection retention now stays broad by default: `beginner` keeps all candidates, `intermediate` keeps about 85%, and `expert` keeps about 70%
- The second pass preprocesses only the selected terms into short wordbook-style entries
- Variables are summarized by value meaning, source, and consumers; functions are summarized by responsibility, inputs/outputs, and important side effects
- Each cache entry stores a symbol-context hash, so unrelated edits elsewhere in the file do not force unchanged symbols through the model again
- Cache files also store a builder version and provider/audience fingerprint, so model, endpoint, audience, or algorithm changes invalidate incompatible summaries
- Long Python/brace-delimited function scopes are retained up to a bounded limit, and the total context budget is divided across candidates so later symbols are not starved by earlier ones
- Wordbook preprocessing runs in chunks of about 20 terms, writes partial cache results after each chunk, and keeps reprioritizing remaining chunks around the areas the user is repeatedly reading
- Wordbook preprocess prompts now force a fast remote path with low reasoning effort and shorter batch outputs
- Preprocess prompt shaping ignores explanation section preferences such as `summary`, `usage`, or `risk`
- Local heuristics remain only as a fallback when the provider cannot perform the selection pass
- The explanation panel shows 5-step preprocess progress with distinct candidate-pool, selected-target, cached-entry, and batch counts, and it does not display batch counters during the earlier selection phase
- The explanation panel shows the full file wordbook sourced from the current file preprocess cache instead of a short preview slice
- Legacy placeholder cache entries from older builds are removed automatically when the file is reopened, so stale partial caches do not appear complete
- Member function references such as `self.squeeze(...)`, `cls.build(...)`, and `this.load(...)` can now enter the wordbook candidate pool as file-local functions
- Visible wordbook entries are annotated with scope paths from the active file and rendered as a collapsible class/function tree instead of one flat list
- Single-symbol explanations first check this file-level preprocess cache before hitting the model again
- If the user changes selection while an explanation request is still running, the older explanation is aborted and the newest selection wins
- Unsaved document edits cancel in-flight preprocessing immediately; `idle` mode may schedule a fresh run after editing stabilizes
- While the panel watches selections, explanation updates no longer keep re-revealing the panel and pulling focus away from the source editor

## Selection-Aware Explanations

- Single-symbol requests classify the selection before prompting, so variables are explained as data flow while functions are explained as callable behavior
- Python aliases such as `import numpy as np`, dotted imports such as `import os.path`, and multi-line `from ... import (...)` statements are resolved to qualified names
- The extension asks the active VS Code language service for hover and definition data, using definition locations to distinguish workspace-local imports from installed libraries when possible
- Library and built-in documentation is added as a concise `文档依据` section and is never expanded into a general API tutorial
- Third-party packages are not imported or executed to discover documentation, avoiding package initialization side effects

## Token Knowledge Cache

The older token knowledge cache still exists as a compatibility fallback for repeated remote token explanations.

- Token cache path: `.read-code-in-chinese/token-knowledge/<language>.json`
- It is used after the file-level preprocess cache misses
- Cache identity includes symbol origin, qualified API name, and local callsite context when needed, preventing same-name APIs such as `numpy.asarray` and `cupy.asarray` from sharing an explanation
- Successful remote token explanations can still be written into this cache for later reuse

## Official Docs Sync

The extension can fetch a preset bundle of official or reference language documents into the same workspace knowledge library.

- Command: `Read Code In Chinese: Sync Official Docs For Active Language`
- Current presets cover:
  - TypeScript
  - JavaScript
  - Python
  - Go
  - Rust
  - Java
- Synced documents are chunked and stored in `.read-code-in-chinese/knowledge/library.json`
- Partial sync success is allowed, so one failed page does not cancel the whole import
- Synced docs enrich later explanation prompts and follow-up answers through retrieval

## Glossary Workflow

1. Open a source file in a workspace.
2. Run an explanation or refresh the glossary.
3. Check the `Code Glossary` view in the Explorer sidebar.
4. Click a glossary item to edit its meaning.
5. Re-run the explanation if you want updated wording immediately.

## Workspace Index Workflow

1. Open a workspace.
2. Run `Read Code In Chinese: Generate Workspace Index`.
3. The extension writes a markdown report under `.read-code-in-chinese/reports/workspace-index.md`.
4. The report opens in the editor and a preview is also shown in the side panel.

## Local Development

### Install

```powershell
npm.cmd install
```

### Compile

```powershell
npm.cmd run compile
```

### Test

```powershell
npm.cmd test
```

### Extension Host Smoke Test

```powershell
$env:VSCODE_EXECUTABLE_PATH="E:\Microsoft VS Code\Code.exe"
npm.cmd run test:extension
```

If `VSCODE_EXECUTABLE_PATH` is omitted, the test runner downloads VS Code 1.89.1 into `.vscode-test/`.

### Run In VS Code

1. Open this repository in VS Code.
2. Run `npm.cmd install`.
3. Run `npm.cmd run compile`.
4. Put your provider settings into `.vscode/.env` if you want to test the remote provider locally.
5. Press `F5` to start the Extension Development Host.
6. The first activation now opens the settings panel automatically.
7. Confirm or edit provider, prompt, and reasoning settings in the settings panel.
8. Open the command palette and run `Read Code In Chinese: Open Conversation Panel`.
9. Keep the panel open and select code to verify automatic explanation updates.
10. Run `Read Code In Chinese: Sync Official Docs For Active Language` to import reference docs.
11. Run `Read Code In Chinese: Preprocess Current File Symbols`, or explicitly change preprocessing mode to `onSave` / `idle` in settings.
12. Re-select a user-defined symbol and verify that later lookups can return from `preprocess-cache`.
13. If the panel still shows `Engine: local`, run `Read Code In Chinese: Show Logs` and check the effective provider settings written at activation time.

The development host can now take provider defaults from environment variables, so testing against another workspace does not require copying provider settings into that target workspace.

## Architecture

High-level architecture:

- `src/extension.ts`: command wiring, selection listeners, onboarding, preprocessing orchestration, logging, cache coordination, and fallback handling
- `src/runtime/`: source-editor tracking, task lifecycle, selection deduplication, and reading-priority state
- `src/analysis/`: glossary extraction, selection semantics, preprocess policy, bounded scope context, and summary heuristics
- `src/providers/`: local and OpenAI-compatible providers
- `src/knowledge/`: imported knowledge document store, official docs sync, fingerprinted file preprocess caching, identity-safe token knowledge fallback, and retrieval
- `src/logging/`: output channel runtime logger
- `src/storage/`: workspace cache paths and JSON persistence
- `src/ui/`: glossary tree, explanation panel, and settings panel

More detail: `docs/ARCHITECTURE.md`

## Project Rules

- Source code comments should use English.
- The extension prefers local cache and lightweight heuristics before remote calls.
- Imported knowledge is workspace-scoped.
- Remote debug secrets stay local because `.vscode/` remains ignored.

## License Note

The repository currently uses `MPL-2.0`, which is already present in the repository. A stricter future non-commercial policy would not be equivalent to a standard OSI open-source license, so that policy question should be handled explicitly before any license change.
