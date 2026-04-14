# Changelog

## Unreleased - 2026-04-14

- Hid batch counters during candidate-pool preparation and selection so the panel no longer shows misleading `0 / N` batch progress before real preprocessing starts
- Added class-member function extraction for `self.xxx(...)`, `cls.xxx(...)`, and `this.xxx(...)` references so more file-local methods enter the wordbook candidate pool
- Added scope-path annotation for wordbook entries and reorganized the wordbook tab into a compact collapsible tree grouped by classes and functions
- Fixed the wordbook tab to render the full current-file cache instead of only the first 12 entries
- Stopped partial preprocess cache writes from storing synthetic placeholder entries as if they were completed results
- Clarified preprocess progress so the UI now separates candidate pool size, selected target count, cached entry count, and processed batches
- Auto-sanitize legacy placeholder wordbook cache entries when reopening a file so stale partial caches do not look complete
- Added a visible file wordbook section in the explanation panel, backed by the current file preprocess cache
- Switched settings-panel prompt generation from local string concatenation to provider-backed prompt-profile generation with local fallback
- Tightened dictionary-style rendering so section bullet items are shown without duplicated paragraph text
- Repaired corrupted fallback Chinese strings in local, preprocess-cache, and follow-up paths
- Added tests for prompt-profile generation and remote section-item normalization
- Validated both prompt generation and token explanation against the configured OpenAI-compatible `gpt-5.4` endpoint
- Split file preprocessing into audience-aware candidate selection plus batch wordbook generation
- Expanded preprocessing coverage to include Python-assigned variables and label-like string terms such as class names
- Made preprocess prompt shaping independent from explanation section preferences
- Stopped watched selection updates from repeatedly re-revealing the panel and stealing focus from the source editor
- Tightened `intermediate` preprocessing so the default medium profile skips overly common symbols such as `forward`
- Injected `occupation` and `professionalLevel` directly into runtime explanation prompts for more reliable audience-aware wording
- Replaced fixed local preprocess-term filtering on the remote path with a dedicated API-driven candidate-selection pass plus local fallback
- Stabilized source-editor monitoring when the user clicks inside the explanation panel
- Changed wordbook retention to keep all beginner candidates, about 85% for intermediate, and about 70% for expert
- Switched wordbook preprocessing to fast chunked batches with partial cache writes and recent-selection-based reprioritization
- Split the webview into a cleaner explanation page and separate wordbook page, and removed suggested-question chips from the explanation UI

## 0.6.0 - 2026-04-14

- Replaced broad token prebuild behavior with file-scoped user-defined symbol preprocessing
- Added preprocess progress tracking, batch counts, and file-level cache reads in the explanation panel
- Aborted stale explain and follow-up requests when newer editor context arrives
- Improved token prompts with exact selection-line previews and glossary hints
- Hardened remote response parsing against alternative content shapes
- Strengthened settings persistence and numeric sanitization
- Added tests for preprocess progress, prompt shaping, and real `squeeze` token smoke validation

## 0.5.0 - 2026-04-14

- Added a real token knowledge prebuild workflow that uses synced knowledge documents plus the remote model
- Added `Read Code In Chinese: Build Token Knowledge For Active Language`
- Auto-build token knowledge after official docs sync for the active language
- Added on-demand token prebuild before falling back to generic token explanation flow
- Expanded the settings panel to edit provider mode, base URL, model, API key env var, timeout, prompt controls, and token prebuild access
- Added tests for token candidate extraction and token knowledge prebuild
- Validated the new token prebuild path against the configured `gpt-5.4` endpoint

## 0.4.0 - 2026-04-14

- Added a first-run settings panel and a command to reopen it later
- Added inline settings access, loading spinner, granularity display, and follow-up reasoning-effort selector in the explanation panel
- Added workspace-local token knowledge caching for repeated single-token explanations
- Switched token explanations to a dedicated shorter remote prompt
- Added remote retry and payload downgrade logic for unstable `content: null` chat completion responses
- Added `provider.reasoningEffort` configuration and endpoint-aware reasoning controls
- Added tests for token knowledge caching

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
