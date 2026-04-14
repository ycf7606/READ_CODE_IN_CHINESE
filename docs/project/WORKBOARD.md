# Project Workboard

## Context Load Order

Every future work session must read these files in order before making changes:

1. `D:\project\代码翻译\后续开发prompt.md`
2. `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
3. The latest file under `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\summaries\`
4. Any stage baseline file directly referenced by the workboard

## Current Status

- Repository: `D:\project\代码翻译\READ_CODE_IN_CHINESE`
- Active stage: Complete
- Latest completed milestone: Stage 15
- Latest summary: `docs/project/summaries/2026-04-14-stage-15.md`
- Tracking policy:
  - New work must update this file.
  - Every completed task must be appended to `docs/project/COMPLETION_LOG.md`.
  - Every stage milestone must generate a new summary file under `docs/project/summaries/`.

## Stage Progress

| Stage | Name | Status | Notes |
| --- | --- | --- | --- |
| 0 | Requirements and baseline | Completed | Baseline decisions documented |
| 1 | Minimal VS Code extension skeleton | Completed | Commands, config, compile path, placeholder execution |
| 2 | Minimal explanation loop | Completed | Explanation request pipeline and provider fallback |
| 3 | Glossary and consistency | Completed | File-level glossary cache and sidebar editing |
| 4 | Multi-granularity explanation | Completed | Selection, file, and workspace views |
| 5 | Follow-up chat | Completed | Webview panel and follow-up conversation |
| 6 | Knowledge augmentation | Completed | Local knowledge import and retrieval attachment |
| 7 | Open-source polish | Completed | Docs, tests, CI, and packaging polish |
| 8 | Runtime polish and market-readiness | Completed | Logging, official docs sync, cleaner panel UX, prompt controls, and real API validation |
| 9 | Provider reliability fix | Completed | Env-based provider resolution, clearer diagnostics, and local fallback repair |
| 10 | Token workflow and settings UX | Completed | Token cache, onboarding settings, loading UI, granularity UI, and reasoning selector |
| 11 | Token knowledge prebuild | Completed | Knowledge-grounded token prebuild, expanded settings, and real API validation |
| 12 | File preprocess and cancellation | Completed | File-scoped symbol preprocessing, stale-request cancellation, grounded token prompts, and settings persistence hardening |
| 13 | Dictionary UX and prompt generation | Completed | Visible file wordbook, remote prompt-profile generation, concise bullet rendering, and real provider validation |
| 14 | Audience-aware wordbook preprocessing | Completed | Two-step candidate selection, label coverage, preprocess prompt isolation, and focus-safe watched updates |
| 15 | Medium-default audience tuning | Completed | Stricter intermediate wordbook filtering and stronger occupation/profession-aware explanation prompts |

## Completed Tasks

- [x] S0-01 Read the initial prompt and convert it into a staged execution model.
- [x] S0-02 Inspect the repository baseline, remote origin, current branch, README, and license.
- [x] S0-03 Create persistent project tracking files for todo, completed items, and stage summaries.
- [x] S0-04 Produce the Stage 0 baseline document with architecture decisions and milestone boundaries.
- [x] S0-05 Produce the Stage 0 summary file for future context loading.
- [x] S1-01 Create the VS Code extension scaffold with a minimal package manifest.
- [x] S1-02 Register base commands for extension activation and feature toggle.
- [x] S1-03 Add project configuration schema for model provider, API key source, and explanation defaults.
- [x] S1-04 Add a placeholder UI path that confirms command execution inside VS Code.
- [x] S1-05 Verify the scaffold by installing dependencies and compiling TypeScript output.
- [x] S1-06 Produce the Stage 1 summary file for future context loading.
- [x] S2-01 Define explanation request and response contracts for the selection flow.
- [x] S2-02 Add a provider adapter layer with local and OpenAI-compatible modes.
- [x] S2-03 Replace the placeholder flow with a real explanation pipeline.
- [x] S2-04 Add latency-aware fallback behavior and user-facing progress feedback.
- [x] S2-05 Produce the Stage 2 summary file.
- [x] S3-01 Generate and cache file-level glossary entries.
- [x] S3-02 Surface the glossary in the Explorer sidebar and support editing.
- [x] S3-03 Preserve user overrides when glossary cache regenerates.
- [x] S3-04 Produce the Stage 3 summary file.
- [x] S4-01 Detect multiple explanation granularities from the current selection.
- [x] S4-02 Add current file overview and workspace index generation.
- [x] S4-03 Write workspace index reports into workspace-local cache.
- [x] S4-04 Produce the Stage 4 summary file.
- [x] S5-01 Add a persistent explanation panel with suggested questions.
- [x] S5-02 Add follow-up chat for the latest explanation context.
- [x] S5-03 Add automatic explanation mode with debounce.
- [x] S5-04 Produce the Stage 5 summary file.
- [x] S6-01 Add workspace-local knowledge import for markdown, text, and JSON.
- [x] S6-02 Attach retrieved knowledge snippets to explanation requests.
- [x] S6-03 Support remote prompt construction for OpenAI-compatible providers.
- [x] S6-04 Produce the Stage 6 summary file.
- [x] S7-01 Add automated tests for core pure modules.
- [x] S7-02 Add CI workflow and packaging ignore rules.
- [x] S7-03 Expand README and supporting repository documentation.
- [x] S7-04 Produce the Stage 7 summary file.
- [x] S8-01 Add runtime logging and an output channel for extension diagnostics.
- [x] S8-02 Make the panel watch active selections and simplify the panel UI.
- [x] S8-03 Add official docs sync and improve workspace knowledge retrieval scoring.
- [x] S8-04 Add custom prompt instructions and remote hyperparameter controls.
- [x] S8-05 Validate the remote provider and official docs sync with real network smoke tests.
- [x] S8-06 Produce the Stage 8 summary file.
- [x] S9-01 Fix settings resolution so env defaults work in the Extension Development Host.
- [x] S9-02 Surface actual engine source and fallback notes more clearly in the panel and logs.
- [x] S9-03 Repair local and remote follow-up text corruption.
- [x] S9-04 Update local dev env defaults for real provider testing across workspaces.
- [x] S9-05 Produce the Stage 9 summary file.
- [x] S10-01 Add token knowledge caching for repeated single-token explanations.
- [x] S10-02 Add a first-run settings panel and settings command.
- [x] S10-03 Add loading, granularity, and reasoning controls to the explanation panel.
- [x] S10-04 Add retry and downgrade handling for unstable remote token responses.
- [x] S10-05 Produce the Stage 10 summary file.
- [x] S11-01 Add a token knowledge prebuild pipeline from synced docs and glossary seeds.
- [x] S11-02 Add command and settings-panel access for token knowledge prebuild.
- [x] S11-03 Auto-warm token knowledge after official docs sync.
- [x] S11-04 Expand settings UI to cover provider controls in addition to prompt and hyperparameters.
- [x] S11-05 Add tests and real smoke validation for the token prebuild workflow.
- [x] S11-06 Produce the Stage 11 summary file.
- [x] S12-01 Replace broad token prebuild behavior with file-scoped symbol preprocessing for user-defined terms.
- [x] S12-02 Abort stale explain and follow-up tasks so the newest selection or editor state wins.
- [x] S12-03 Ground token prompts in selection-line previews and strengthen remote content parsing.
- [x] S12-04 Harden settings persistence, generated-prompt workflow, and preprocess progress scoping.
- [x] S12-05 Produce the Stage 12 summary file.
- [x] S13-01 Expose the current file preprocess cache as a visible wordbook inside the explanation panel.
- [x] S13-02 Replace local prompt-template generation in the settings panel with provider-backed prompt-profile generation and local fallback.
- [x] S13-03 Make dictionary-style bullet rendering the default panel presentation and repair corrupted local fallback strings.
- [x] S13-04 Load and refresh wordbook state on activation, editor switch, save, and preprocess completion.
- [x] S13-05 Add tests for prompt-profile generation and remote section-item normalization.
- [x] S13-06 Produce the Stage 13 summary file.
- [x] S14-01 Split preprocessing into audience-aware candidate selection and batch wordbook generation.
- [x] S14-02 Expand glossary and preprocessing coverage to include Python-assigned variables and string-form labels.
- [x] S14-03 Isolate preprocess prompt shaping from explanation section preferences.
- [x] S14-04 Stop watched updates from repeatedly re-revealing the panel and pulling focus away from the source editor.
- [x] S14-05 Add tests and real smoke validation for the new wordbook candidate pipeline.
- [x] S14-06 Produce the Stage 14 summary file.
- [x] S15-01 Tighten `intermediate` wordbook filtering so the default medium profile skips trivial common symbols.
- [x] S15-02 Inject occupation and professional level directly into explanation requests and runtime prompts.
- [x] S15-03 Add regression coverage and smoke validation for medium-default filtering and audience-aware prompt shaping.
- [x] S15-04 Produce the Stage 15 summary file.

## Current Todo

- [ ] No open implementation tasks in the current delivery scope.

## Open Decisions Locked for Now

- Use a staged implementation instead of building all six explanation granularities at once.
- Use local static analysis and cache first; retrieval augmentation comes later.
- Treat file-level glossary as the first stable cache scope.
- Keep explanation output structured and short by default.
- Keep the explanation panel as the primary lightweight interaction surface.

## Notes

- The core extension workflow is implemented end-to-end and validated by compile, unit tests, and real provider smoke tests.
- A Stage 9 fix closed the gap where VS Code schema defaults could hide env-based provider settings during development-host testing.
- A Stage 10 update added a dedicated token explanation workflow and user-facing settings UI so token explanations are less template-like and more controllable.
- A Stage 11 update turned token knowledge into a real prebuild workflow backed by synced docs plus remote reasoning, instead of only caching after first use.
- A Stage 12 update replaced the broad token prebuild behavior with file-scoped symbol preprocessing, added stale-task cancellation, and improved single-token prompt grounding with exact callsite previews.
- A Stage 13 update exposed the file preprocess cache as a visible wordbook, switched settings prompt generation to the remote provider when available, and tightened the UI around concise dictionary-style bullet output.
- A Stage 14 update made preprocessing audience-aware, added label/string coverage, isolated the wordbook prompt from explanation sections, and reduced focus disruption while the panel watches selection changes.
- A Stage 15 update tightened the default medium (`intermediate`) wordbook profile and made runtime explanation prompts explicitly audience-aware even without regenerating the editable prompt.
- The existing `LICENSE` is MPL-2.0. The user's desired "non-commercial + attribution required" policy is not equivalent to a standard OSI open-source license and remains a future licensing decision point.
- Code comments inside the repository should use English by default.
- Local VS Code debug files under `.vscode/` remain git-ignored so secrets do not reach the repository.
