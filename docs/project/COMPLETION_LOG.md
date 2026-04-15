# Completion Log

## 2026-04-13

### S0-01 Read and normalize the execution prompt

- Stage: 0
- Result: Established a staged development model from the original idea prompt.
- Files: `D:\project\浠ｇ爜缈昏瘧\鍚庣画寮€鍙慞rompt.md`
- Verification: Prompt file was created and re-read with UTF-8 decoding.

### S0-02 Inspect repository baseline

- Stage: 0
- Result: Confirmed repository root, remote origin, branch name, current README, and current license.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.git\config`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.git\HEAD`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\LICENSE`
- Verification: Repository structure and git metadata were read directly from the repo.

### S0-03 Create persistent tracking files

- Stage: 0
- Result: Added a workboard, completion log, and stage summary storage convention.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\COMPLETION_LOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-13-stage-0.md`
- Verification: Files are present in the repository and referenced by the workboard.

### S0-04 Produce the Stage 0 baseline

- Stage: 0
- Result: Locked the first architecture decisions, scope boundaries, and Stage 1 entry criteria.
- Files: `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\STAGE_0_BASELINE.md`
- Verification: Baseline document is linked from the workboard and summary.

### S0-05 Publish the Stage 0 summary

- Stage: 0
- Result: Captured milestone output, decisions, risks, and next tasks in a reusable summary file.
- Files: `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-13-stage-0.md`
- Verification: Summary path is recorded as the latest summary in the workboard.

### S1-01 Create the extension scaffold

- Stage: 1
- Result: Added the VS Code extension manifest, TypeScript compiler config, source entry point, and git ignore rules.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\tsconfig.json`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.gitignore`
- Verification: Repository now contains a valid extension skeleton and source entry.

### S1-02 Register base commands

- Stage: 1
- Result: Registered `Explain Selection` and `Toggle Auto Explain` commands with command palette and keybindings.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: Commands are declared in the manifest and implemented in the extension entry point.

### S1-03 Add configuration schema

- Stage: 1
- Result: Added workspace settings for provider id, base URL, model, API key environment variable, detail level, professional level, and explanation sections.
- Files: `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification: Settings are exposed through `contributes.configuration` and consumed by the extension code.

### S1-04 Add placeholder execution path

- Stage: 1
- Result: The extension can read the current selection and show a placeholder explanation message inside VS Code.
- Files: `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: The placeholder message path is implemented and wired to the command.

### S1-05 Install dependencies and compile output

- Stage: 1
- Result: Installed TypeScript and type packages, then generated `dist/extension.js`.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package-lock.json`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\dist\extension.js`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\dist\extension.js.map`
- Verification:
  - `npm.cmd install`
  - `npm.cmd run compile`

### S1-06 Publish the Stage 1 summary

- Stage: 1
- Result: Captured the scaffold milestone output, validation result, and next-stage direction.
- Files: `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-13-stage-1.md`
- Verification: Workboard points to the Stage 1 summary as the latest milestone.

### S2-01 Define explanation contracts and pipeline

- Stage: 2
- Result: Added typed explanation requests, responses, prompt construction, provider contracts, and fallback execution flow.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\config.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\providerTypes.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\createProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: `npm.cmd run compile`

### S3-01 Add glossary cache and sidebar workflow

- Stage: 3
- Result: Added glossary extraction, cache persistence, Explorer sidebar rendering, and user override preservation.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\glossary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\storage\workspaceStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\glossaryTreeProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: `npm.cmd run compile`

### S4-01 Add multi-granularity explanation flow

- Stage: 4
- Result: Added token, statement, block, function, file, and workspace-level explanation paths.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\summary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: `npm.cmd run compile`

### S5-01 Add panel-based interaction and follow-up chat

- Stage: 5
- Result: Added the explanation panel, suggested questions, follow-up chat, and automatic explanation mode.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification: `npm.cmd run compile`

### S6-01 Add imported knowledge retrieval

- Stage: 6
- Result: Added workspace-local knowledge import and retrieval for explanation requests.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\knowledgeStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification: `npm.cmd run compile`

### S7-01 Add tests, CI, and repository docs

- Stage: 7
- Result: Added unit tests, CI workflow, packaging ignore rules, and repository-level docs for development, contribution, security, architecture, and knowledge import.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.github\workflows\ci.yml`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.vscodeignore`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CONTRIBUTING.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\SECURITY.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\knowledge\IMPORTING_KNOWLEDGE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\knowledge\knowledge-sample.json`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

## 2026-04-14

### S8-01 Add runtime logging and richer diagnostics

- Stage: 8
- Result: Added a dedicated VS Code output channel logger, console mirroring, provider request diagnostics, glossary cache logs, and fallback error logging.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\logging\logger.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification:
  - `npm.cmd run compile`
  - Real provider smoke test through `dist/providers/openAICompatibleProvider.js`

### S8-02 Make the panel watch selections and simplify the UI

- Stage: 8
- Result: The explanation panel now keeps watching the active selection when open, surfaces file and selection metadata, and uses a cleaner VS Code-native visual style.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S8-03 Add official docs sync and improve knowledge scoring

- Stage: 8
- Result: Added official docs sync presets for major languages, chunked import into the knowledge library, resilient document downloads, and weighted retrieval scoring.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\officialDocs.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\knowledgeStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`
  - Official docs sync smoke test through `dist/knowledge/officialDocs.js`

### S8-04 Add custom prompt instructions and provider hyperparameters

- Stage: 8
- Result: Added workspace settings for custom prompt instructions and remote provider sampling parameters, and wired them into prompt construction and remote calls.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\config.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification:
  - `npm.cmd run compile`
  - Real provider smoke test through `dist/providers/openAICompatibleProvider.js`

### S8-05 Add local VS Code debug wiring for real API testing

- Stage: 8
- Result: Created local ignored `.vscode` settings, env file, and launch configuration so the Extension Development Host uses the real OpenAI-compatible provider without exposing secrets to Git.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.vscode\settings.json`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.vscode\.env`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.vscode\launch.json`
- Verification:
  - `code.cmd` is available locally
  - The repository `.gitignore` excludes `.vscode/`

### S8-06 Update docs and publish the Stage 8 summary

- Stage: 8
- Result: Updated README, architecture docs, knowledge import docs, changelog, workboard, and created the Stage 8 summary for future context loading.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\knowledge\IMPORTING_KNOWLEDGE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-8.md`
- Verification:
  - Manual review of the updated context files

### S9-01 Fix provider resolution for development-host testing

- Stage: 9
- Result: Changed settings resolution to prefer explicit VS Code configuration but fall back to environment defaults when the current workspace has no explicit provider settings.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\config.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\.vscode\.env`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S9-02 Add clearer engine diagnostics

- Stage: 9
- Result: Logged effective settings and provider selection, and surfaced engine source and fallback notes directly inside the explanation panel.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\createProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S9-03 Repair fallback follow-up text corruption

- Stage: 9
- Result: Rewrote local follow-up answers and remote suggested follow-up strings to remove corrupted text and make fallback behavior explicit.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S9-04 Update docs and publish the Stage 9 summary

- Stage: 9
- Result: Updated README, architecture notes, changelog, workboard, and added the Stage 9 summary describing the root cause and fix.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-9.md`
- Verification:
  - Manual review of the updated context files

### S10-01 Add token knowledge caching

- Stage: 10
- Result: Added workspace-local token knowledge storage so successful single-token explanations can be reused instead of re-calling the model every time.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\tokenKnowledgeStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\storage\workspaceStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S10-02 Add settings onboarding and editable settings UI

- Stage: 10
- Result: Added a first-run settings panel, a command to reopen it, and settings editing controls for prompt and hyperparameters.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\settingsPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification:
  - `npm.cmd run compile`

### S10-03 Add panel loading and classification UI

- Stage: 10
- Result: Added a loading spinner, six-class granularity display, inline settings button, and follow-up reasoning-effort selector in the explanation panel.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`

### S10-04 Harden token remote requests

- Stage: 10
- Result: Switched token explanations to a dedicated shorter prompt, added `provider.reasoningEffort`, and added multi-attempt remote retry/downgrade logic for unstable `content: null` responses.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\config.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\package.json`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`
  - Real token smoke test with `squeeze` against `gpt-5.4`

### S10-05 Update docs and publish the Stage 10 summary

- Stage: 10
- Result: Updated README, architecture notes, changelog, workboard, and added the Stage 10 summary.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-10.md`
- Verification:
  - Manual review of the updated context files

### S11-01 Add token knowledge prebuild

- Stage: 11
- Result: Added a real token knowledge prebuild flow that uses synced knowledge documents, active glossary seeds, and remote model reasoning to create reusable token entries.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\knowledge\knowledgeStore.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\knowledge\tokenKnowledgeBuilder.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\contracts.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S11-02 Add UI and command access for token prebuild

- Stage: 11
- Result: Added a dedicated command for token knowledge prebuild and exposed the same action from the settings panel.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\package.json`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\ui\settingsPanel.ts`
- Verification:
  - `npm.cmd run compile`

### S11-03 Auto-warm token knowledge after official docs sync

- Stage: 11
- Result: Official docs sync now immediately attempts to prebuild token knowledge for the active language when the remote provider is available.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\knowledge\officialDocs.ts`
- Verification:
  - `npm.cmd run compile`

### S11-04 Expand settings panel coverage

- Stage: 11
- Result: The settings panel now covers provider mode, base URL, model, API key environment variable name, timeout, prompt instructions, and sampling controls.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\ui\settingsPanel.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\config.ts`
- Verification:
  - `npm.cmd run compile`

### S11-05 Add validation for token prebuild

- Stage: 11
- Result: Added tests for token candidate extraction and token prebuild, and validated the real remote path against the configured `gpt-5.4` endpoint.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\test\index.test.ts`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\src\knowledge\tokenKnowledgeBuilder.ts`
- Verification:
  - `npm.cmd test`
  - Real smoke test for `squeeze` through the configured OpenAI-compatible endpoint

### S11-06 Update docs and publish the Stage 11 summary

- Stage: 11
- Result: Updated README, architecture notes, changelog, workboard, and added the Stage 11 summary for future context loading.
- Files:
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-10.md`
  - `D:\project\娴狅絿鐖滅紙鏄忕槯\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-11.md`
- Verification:
  - Manual review of the updated context files

### S12-01 Replace token prebuild with file-scoped symbol preprocessing

- Stage: 12
- Result: Replaced the broad token-prebuild-first path with a file-scoped preprocess cache that batches user-defined variables, functions, classes, and types using full-file context.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\preprocess.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\preprocessStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\storage\workspaceStore.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S12-02 Abort stale explain and follow-up tasks

- Stage: 12
- Result: Added explicit cancellation for stale explanation, follow-up, and preprocess tasks so the newest selection or editor change wins instead of queueing outdated work.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\providerTypes.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S12-03 Improve token grounding and remote response parsing

- Stage: 12
- Result: Added selection-line preview context and glossary hints to token prompts, and expanded remote response parsing so alternate content payload shapes can still be read before falling back.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\tokenKnowledgeBuilder.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`
  - Real remote smoke test for `squeeze` through the configured `gpt-5.4` endpoint

### S12-04 Harden settings persistence and progress scoping

- Stage: 12
- Result: Made reasoning-effort updates persist through the same save path as the settings panel, sanitized numeric settings input, and scoped preprocess progress visibility to the active file.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\settingsPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S12-05 Update docs and publish the Stage 12 summary

- Stage: 12
- Result: Updated the README, architecture notes, changelog, workboard, and added the Stage 12 summary so future sessions load the new preprocess-first behavior instead of the retired Stage 11 narrative.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-12.md`
- Verification:
  - Manual review of the updated context files

### S13-01 Expose file wordbook in the explanation panel

- Stage: 13
- Result: The explanation panel now shows a visible file wordbook backed by the current file preprocess cache, and it refreshes when the editor context changes.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S13-02 Switch settings prompt generation to the provider

- Stage: 13
- Result: The settings panel now sends the full audience and provider profile to the configured provider for prompt generation, with local fallback if the remote provider fails.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\settingsPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\providerTypes.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\globalPromptProfile.ts`
- Verification:
  - `npm.cmd run compile`
  - Real prompt-profile smoke test through `dist/providers/openAICompatibleProvider.js`

### S13-03 Tighten dictionary-style presentation and fallback text

- Stage: 13
- Result: Section rendering now prefers bullet items without duplicated paragraph content, and local/cache fallback strings were rewritten into concise readable Chinese.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\summary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S13-04 Add tests and publish the Stage 13 summary

- Stage: 13
- Result: Added regression coverage for prompt-profile generation and section-item normalization, then updated project docs and stage tracking files.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-13.md`
- Verification:
  - `npm.cmd test`
  - Real remote `squeeze` explanation smoke test through `dist/providers/openAICompatibleProvider.js`

### S14-01 Add audience-aware wordbook candidate selection

- Stage: 14
- Result: File preprocessing now first selects wordbook candidates from the glossary using audience-aware filtering before sending the batch preprocess request.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\preprocess.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S14-02 Expand glossary coverage for variables and labels

- Stage: 14
- Result: Glossary extraction now includes Python-assigned variables, instance attributes, and label-like string terms such as class names so they can enter the file wordbook.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\glossary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
- Verification:
  - `npm.cmd test`
  - Real preprocess smoke test through `dist/providers/openAICompatibleProvider.js`

### S14-03 Isolate wordbook prompt shaping and reduce focus disruption

- Stage: 14
- Result: Preprocess prompt shaping now ignores explanation section preferences, and watched selection updates no longer keep re-revealing the panel when it is already open.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\globalPromptProfile.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S14-04 Publish Stage 14 tracking and smoke results

- Stage: 14
- Result: Updated repository docs and project tracking, then validated that beginner preprocessing includes `forward` while expert preprocessing skips it and still keeps `PCA` / `ICA` label entries.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-14.md`
- Verification:
  - `npm.cmd test`
  - Real preprocess smoke test through `dist/providers/openAICompatibleProvider.js`

### S15-01 Tighten the default medium wordbook profile

- Stage: 15
- Result: The default `intermediate` preprocessing profile now behaves like the intended medium audience and skips overly common symbols such as `forward`.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\preprocess.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S15-02 Inject audience profile directly into explanation prompts

- Stage: 15
- Result: Explanation requests now carry `occupation`, and runtime explain/follow-up prompts explicitly include both occupation and professional level to keep outputs audience-aware even without regenerating the editable prompt.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\tokenKnowledgeBuilder.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`
  - Prompt smoke inspection through `dist/prompts/openAICompatiblePrompt.js`

### S15-03 Publish Stage 15 tracking and smoke results

- Stage: 15
- Result: Updated docs and tracking, then confirmed by smoke test that `intermediate` candidates no longer include `forward` while token prompts explicitly show `Occupation` and `Professional level`.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-15.md`
- Verification:
  - `npm.cmd test`
  - Prompt and candidate smoke inspection through `dist/analysis/preprocess.js` and `dist/prompts/openAICompatiblePrompt.js`


### S16-01 Add provider-backed preprocess candidate selection

- Stage: 16
- Result: Added dedicated request and response handling for preprocess candidate selection, including remote prompt generation, provider mode wiring, and response normalization.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\providers\providerTypes.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S16-02 Route preprocess through raw candidate pools and remote selection

- Stage: 16
- Result: Reworked file preprocessing so the extension builds a raw candidate pool first, lets the provider choose wordbook terms, then preprocesses only the selected terms with a 5-step progress model and cache-aware messages.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\analysis\preprocess.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S16-03 Add regression coverage for API-driven selection

- Stage: 16
- Result: Added tests for remote preprocess candidate normalization and updated preprocess-cache assertions to match the provider-selected candidate flow and 5-step progress tracking.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd test`

### S16-04 Update docs and publish the Stage 16 summary

- Stage: 16
- Result: Updated README, architecture notes, changelog, workboard, and added the Stage 16 summary so future sessions load the new API-driven preprocess-selection flow.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-16.md`
- Verification:
  - Manual review of the updated context files

### S17-01 Keep monitoring stable while using the panel

- Stage: 17
- Result: Clicking inside the explanation panel no longer drops the current source-editor context or cancels same-file reading state, so selection watching remains stable while the user uses the panel.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S17-02 Retune wordbook retention and ranking

- Stage: 17
- Result: Wordbook candidate retention now keeps all beginner candidates, about 85% for intermediate, and about 70% for expert, with common-item handling downgraded from hard filtering to audience-aware ranking.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\analysis\preprocess.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\prompts\openAICompatiblePrompt.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S17-03 Add fast chunked wordbook preprocessing

- Stage: 17
- Result: File wordbook preprocessing now runs in fast low-reasoning chunks of about 20 symbols, writes partial cache files after each chunk, and reprioritizes remaining chunks around recently selected code regions.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\????\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S17-04 Split explanation and wordbook pages

- Stage: 17
- Result: The webview now uses a cleaner explanation page plus a separate wordbook page, and the suggested-question chips were removed from the explanation UI.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S17-05 Update docs and publish the Stage 17 summary

- Stage: 17
- Result: Updated README, architecture notes, changelog, workboard, and added the Stage 17 summary so future sessions load the new focus-safe chunked wordbook workflow.
- Files:
  - `D:\project\????\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\????\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-17.md`
- Verification:
  - Manual review of the updated context files

### S18-01 Render the full current-file wordbook

- Stage: 18
- Result: Removed the wordbook tab preview limit so the panel now renders the full current file cache instead of only the first 12 entries.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S18-02 Fix preprocess cache integrity

- Stage: 18
- Result: Stopped partial cache writes from storing synthetic placeholder entries, ignored placeholder-like legacy entries when resuming preprocessing, and ensured remote/local preprocess results are marked as real entries.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\openAICompatibleProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\providers\localProvider.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S18-03 Clarify preprocess progress semantics

- Stage: 18
- Result: Split preprocess progress reporting into candidate-pool size, selected-target count, cached-entry count, and processed batches so the UI matches real build state.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S18-04 Sanitize legacy wordbook caches on load

- Stage: 18
- Result: Added load-time cleanup for placeholder-like legacy wordbook cache entries so old incomplete caches no longer appear complete after reopening the file.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S18-05 Publish the Stage 18 summary

- Stage: 18
- Result: Updated README, architecture docs, changelog, workboard, and created the Stage 18 summary for future context loading.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\COMPLETION_LOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-18.md`
- Verification:
  - Manual review of the updated context files

### S19-01 Hide batch counters during candidate selection

- Stage: 19
- Result: Stopped rendering misleading `0 / N` batch counters during candidate-pool preparation and wordbook term selection, while keeping batch progress visible for real preprocessing work.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\knowledge\symbolPreprocessBuilder.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S19-02 Add class-member function extraction

- Stage: 19
- Result: Added extraction for member-function references such as `self.xxx(...)`, `cls.xxx(...)`, and `this.xxx(...)` so more class-local methods can enter the wordbook candidate pool.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\glossary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S19-03 Add scope-based wordbook tree rendering

- Stage: 19
- Result: Annotated visible wordbook entries with class/function scope paths from the active file and replaced the flat wordbook list with a compact collapsible tree.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\wordbook.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\contracts.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S19-04 Add regression coverage for scope grouping and progress semantics

- Stage: 19
- Result: Added tests for Python member-function extraction, wordbook scope-path annotation, and selection-phase preprocess progress batch semantics.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd test`

### S19-05 Publish the Stage 19 summary

- Stage: 19
- Result: Updated README, architecture docs, changelog, workboard, and created the Stage 19 summary for future context loading.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\COMPLETION_LOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-19.md`
- Verification:
  - Manual review of the updated context files

### S20-01 Add qualified API call symbol extraction

- Stage: 20
- Result: Added extraction for qualified call symbols such as `nn.Parameter(...)` and `torch.empty(...)`, so those callable names can participate in glossary generation and wordbook preprocessing.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\analysis\glossary.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\test\index.test.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S20-02 Add current-selection focus and markdown rendering

- Stage: 20
- Result: Added a prominent current-selection focus card at the top of the explanation page and basic markdown rendering for summaries, sections, wordbook entries, and follow-up chat.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S20-03 Remove glossary snapshot UI payload

- Stage: 20
- Result: Removed the `Glossary Snapshot` panel block and stopped sending its unused state payload into the webview.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\ui\explanationPanel.ts`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\src\extension.ts`
- Verification:
  - `npm.cmd run compile`
  - `npm.cmd test`

### S20-04 Publish the Stage 20 summary

- Stage: 20
- Result: Updated README, architecture docs, changelog, workboard, and created the Stage 20 summary for future context loading.
- Files:
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\README.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\ARCHITECTURE.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\CHANGELOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\COMPLETION_LOG.md`
  - `D:\project\浠ｇ爜缈昏瘧\READ_CODE_IN_CHINESE\docs\project\summaries\2026-04-14-stage-20.md`
- Verification:
  - Manual review of the updated context files

### S21-01 Add hybrid LSP glossary extraction and layered wordbook UX

- Stage: 21
- Result: Upgraded glossary generation to merge regex extraction with VS Code document symbols, versioned the glossary cache, propagated local/external scope metadata through preprocessing, and rebuilt the wordbook tab as a layered searchable/filterable tree with per-file persisted expand state.
- Files:
  - `src/analysis/documentStructure.ts`
  - `src/analysis/documentSymbols.ts`
  - `src/analysis/glossary.ts`
  - `src/analysis/preprocess.ts`
  - `src/extension.ts`
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/prompts/openAICompatiblePrompt.ts`
  - `src/providers/localProvider.ts`
  - `src/providers/openAICompatibleProvider.ts`
  - `src/ui/explanationPanel.ts`
  - `src/test/index.test.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-14-stage-21.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`




### S22-01 Recover panel interactivity and scale the wordbook pipeline

- Stage: 22
- Result: Hardened the explanation-panel webview, added preprocess cache versioning, expanded TS/Python external symbol extraction, and reduced large-wordbook rendering cost with lazy tree hydration plus near-selection filtering.
- Files:
  - `src/ui/explanationPanel.ts`
  - `src/extension.ts`
  - `src/knowledge/preprocessStore.ts`
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/analysis/glossary.ts`
  - `src/analysis/typeScriptAstGlossary.ts`
  - `src/contracts.ts`
  - `src/test/index.test.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-22.md`
- Verification:
  - `cmd /c npm.cmd test`

### S23-01 Isolate source-editor state and stabilize auto explain

- Stage: 23
- Result: Stopped output/log editors from replacing the tracked source editor, prevented same-selection auto-explain churn with scheduled/active/settled signatures, and routed source-dependent commands through the last valid source editor.
- Files:
  - `src/extension.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-23.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S24-01 Fix panel settings navigation and preprocess visibility

- Stage: 24
- Result: Made the explanation-panel `Settings` control foreground-safe with a command-URI path plus non-preserve-focus settings reveals, and brought the explanation panel forward for user-triggered preprocessing while adding clearer preprocess status text to the explain page.
- Files:
  - `src/ui/explanationPanel.ts`
  - `src/ui/settingsPanel.ts`
  - `src/extension.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-24.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S25-01 Resynchronize panel selection watch and wordbook state

- Stage: 25
- Result: Changed watched-selection semantics to depend on panel visibility, replayed the current selection when the explanation panel becomes ready, and synchronized wordbook/progress/file-context updates more aggressively during preprocess runs.
- Files:
  - `src/extension.ts`
  - `src/ui/explanationPanel.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-25.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S26-01 Split watch/reveal semantics and add wordbook diagnostics

- Stage: 26
- Result: Split panel-open and panel-visible semantics so monitored selection watching no longer depends on the same boolean as auto-reveal, and added logs that show whether wordbook cache entries are loaded, outdated, or updated during preprocess.
- Files:
  - `src/extension.ts`
  - `src/ui/explanationPanel.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-26.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`
