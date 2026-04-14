# READ_CODE_IN_CHINESE

`READ_CODE_IN_CHINESE` is a VS Code extension for turning source code into concise Chinese explanations while keeping terminology, official reference context, file role, and follow-up questions in one workflow.

## What It Does

- Explain the current selection with a compact structured response
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
- Keep the panel open and automatically refresh when the code selection changes
- Write runtime diagnostics into a dedicated VS Code output channel
- Use either:
  - a local heuristic engine
  - an OpenAI-compatible remote provider

## Current Status

- Stage 0-7 completed
- Stage 16 API-driven wordbook candidate selection is complete, so file preprocessing now uses a dedicated provider pass before batch wordbook generation
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
  - one detected category for the current selection
  - loading spinner while remote analysis is running
  - automatic selection watching when the panel is open
  - inline reasoning-effort selector for follow-up chat
  - settings button that opens the configuration panel
  - preprocess progress, symbol counts, and cache-aware status messages
  - visible file wordbook for the current file preprocess cache
  - suggested follow-up questions
  - glossary snapshot
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
- `readCodeInChinese.provider.timeoutMs`
- `readCodeInChinese.provider.temperature`
- `readCodeInChinese.provider.topP`
- `readCodeInChinese.provider.maxTokens`
- `readCodeInChinese.provider.reasoningEffort`

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

When the remote provider is enabled, the extension can preprocess the active file's user-defined variables, functions, classes, types, and string-form labels in one batch using full-file context.

- Preprocess cache path: `.read-code-in-chinese/preprocess/<file>.json`
- Command: `Read Code In Chinese: Preprocess Current File Symbols`
- When a remote provider is enabled, a dedicated API selection pass chooses wordbook terms from the raw file candidate pool using full-file context, `professionalLevel`, and `occupation`
- The second pass preprocesses only the selected terms into short wordbook-style entries
- `professionalLevel = intermediate` acts as the practical default "medium" audience and skips overly common symbols such as `forward`
- `professionalLevel = beginner` keeps more guidance-heavy entries
- `professionalLevel = expert` keeps an even smaller wordbook than `intermediate`
- Preprocess prompt shaping ignores explanation section preferences such as `summary`, `usage`, or `risk`
- Local heuristics remain only as a fallback when the provider cannot perform the selection pass
- The explanation panel shows 5-step preprocess progress, symbol counts, batch count, and cache-aware status messages
- The explanation panel also shows a visible file wordbook sourced from the current file preprocess cache
- Single-symbol explanations first check this file-level preprocess cache before hitting the model again
- If the user changes selection while a request is still running, the older request is aborted and the newest selection wins
- While the panel watches selections, explanation updates no longer keep re-revealing the panel and pulling focus away from the source editor

## Token Knowledge Cache

The older token knowledge cache still exists as a compatibility fallback for repeated remote token explanations.

- Token cache path: `.read-code-in-chinese/token-knowledge/<language>.json`
- It is used after the file-level preprocess cache misses
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
11. Run `Read Code In Chinese: Preprocess Current File Symbols`, or keep the panel open and let the active file preprocess automatically.
12. Re-select a user-defined symbol and verify that later lookups can return from `preprocess-cache`.
13. If the panel still shows `Engine: local`, run `Read Code In Chinese: Show Logs` and check the effective provider settings written at activation time.

The development host can now take provider defaults from environment variables, so testing against another workspace does not require copying provider settings into that target workspace.

## Architecture

High-level architecture:

- `src/extension.ts`: command wiring, selection listeners, session flow, onboarding, preprocessing orchestration, logging, cache coordination, cancellation, and fallback handling
- `src/analysis/`: glossary extraction and summary heuristics
- `src/providers/`: local and OpenAI-compatible providers
- `src/knowledge/`: imported knowledge document store, official docs sync, file preprocess caching, token knowledge fallback, and retrieval
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
