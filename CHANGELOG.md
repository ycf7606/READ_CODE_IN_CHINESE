# Changelog

## 0.3.1 - 2026-04-14

- Fixed provider configuration resolution so environment defaults can drive the development host even when testing against another workspace
- Added clearer provider selection diagnostics to the logs
- Surfaced engine source and fallback notes directly inside the explanation panel
- Repaired corrupted follow-up suggestion strings in both local and remote paths
- Expanded the local ignored `.vscode/.env` template to include remote provider defaults

## 0.3.0 - 2026-04-14

- Added a VS Code output channel logger and richer runtime diagnostics
- Added panel-open selection watching so explanations refresh automatically while the panel stays open
- Added official docs sync for active languages and improved knowledge search scoring
- Added provider hyperparameters and custom prompt instruction settings
- Simplified the panel UI and surfaced selection metadata, glossary snapshot, and status details
- Validated the remote provider against a real OpenAI-compatible `gpt-5.4` endpoint
- Added local ignored VS Code debug settings for real API testing
- Added tests for official docs presets and knowledge ranking
- Hardened remote parsing and fallback behavior
- Fixed local provider text corruption caused by unstable source strings

## 0.2.0 - 2026-04-13

- Added structured explanation pipeline with local and OpenAI-compatible providers
- Added file-level glossary cache and Explorer sidebar glossary view
- Added explanation panel with follow-up chat
- Added current file overview and workspace index commands
- Added local knowledge import and retrieval support
- Added tests, CI workflow, and open-source project documentation

## 0.1.0 - 2026-04-13

- Added initial VS Code extension scaffold
- Added base commands and configuration schema
- Added placeholder explanation flow
