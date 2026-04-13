# READ_CODE_IN_CHINESE

`READ_CODE_IN_CHINESE` is a VS Code extension for turning source code into concise Chinese explanations while keeping terminology, file role, and follow-up questions in one workflow.

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
- Let users edit glossary meanings and re-run explanations
- Support follow-up chat in a side panel
- Import local knowledge documents for retrieval-enhanced explanations
- Use either:
  - a local heuristic engine
  - an OpenAI-compatible remote provider

## Current Status

- Stage 0 completed
- Stage 1 completed
- Stage 2-6 implementation is now present in the extension codebase
- Stage 7 open-source polish is included through docs, tests, and CI
- Tracking board: `docs/project/WORKBOARD.md`

## Main Commands

- `Read Code In Chinese: Explain Selection`
- `Read Code In Chinese: Toggle Auto Explain`
- `Read Code In Chinese: Open Conversation Panel`
- `Read Code In Chinese: Explain Current File`
- `Read Code In Chinese: Generate Workspace Index`
- `Read Code In Chinese: Refresh Glossary`
- `Read Code In Chinese: Import Knowledge Documents`

## Default Shortcuts

- `Ctrl+Alt+E`: explain current selection
- `Ctrl+Alt+T`: toggle auto explain
- `Ctrl+Alt+F`: explain current file

## Sidebar And Panel

- Explorer sidebar view: `Code Glossary`
- Webview panel:
  - latest explanation
  - suggested follow-up questions
  - workspace index preview
  - follow-up chat

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

### Explanation Output

- `readCodeInChinese.explanation.detailLevel`
- `readCodeInChinese.explanation.professionalLevel`
- `readCodeInChinese.explanation.sections`
- `readCodeInChinese.explanation.userGoal`

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
- environment variable named by `readCodeInChinese.provider.apiKeyEnvVar`

Example in PowerShell:

```powershell
$env:READ_CODE_IN_CHINESE_API_KEY="your-api-key"
```

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
4. Press `F5` to start the Extension Development Host.
5. Open a source file and try the commands from the command palette.

## Architecture

High-level architecture:

- `src/extension.ts`: command wiring, selection listeners, session flow
- `src/analysis/`: glossary extraction and summary heuristics
- `src/providers/`: local and OpenAI-compatible providers
- `src/knowledge/`: imported knowledge document store and retrieval
- `src/storage/`: workspace cache paths and JSON persistence
- `src/ui/`: glossary tree and explanation panel

More detail: `docs/ARCHITECTURE.md`

## Project Rules

- Source code comments should use English.
- The extension prefers local cache and lightweight heuristics before remote calls.
- Imported knowledge is workspace-scoped.

## License Note

The repository currently uses `MPL-2.0`, which is already present in the repository. A stricter future non-commercial policy would not be equivalent to a standard OSI open-source license, so that policy question should be handled explicitly before any license change.
