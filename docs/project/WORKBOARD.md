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
- Latest completed milestone: Stage 30
- Latest summary: `docs/project/summaries/2026-04-15-stage-30.md`
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
| 16 | API-driven preprocess selection | Completed | Remote candidate selection, 5-step preprocess progress, and resilient local fallback |
| 17 | Focus-safe wordbook chunking and UI cleanup | Completed | Stable panel monitoring, chunked fast preprocessing, retention tuning, and cleaner split-page UI |
| 18 | Wordbook cache integrity and progress clarity | Completed | Full wordbook rendering, placeholder-safe cache writes, legacy cache cleanup, and clearer progress counts |
| 19 | Wordbook scope tree and member coverage | Completed | Selection-phase progress cleanup, class-member function extraction, and collapsible scope-based wordbook UI |
| 20 | Selection-focused explanation polish | Completed | Qualified-call API symbol extraction, top-of-page selection focus, markdown rendering, and glossary snapshot removal |
| 21 | LSP-aware wordbook structure | Completed | Hybrid LSP glossary extraction, local/API wordbook layers, search/scope filters, and per-file expand-state persistence |
| 22 | Panel recovery and scalable extraction | Completed | Webview script hardening, preprocess cache versioning, TS AST external extraction, Python alias/decorator coverage, and near-selection wordbook filtering |
| 27 | Rollback to stable Stage 22 baseline | Completed | Reverted unstable post-Stage-22 panel state changes, verified the Stage 22 baseline, and documented a new reimplementation route |
| 28 | Rollback to stable Stage 19 baseline | Completed | Pulled the Stage 19 code snapshot directly, removed Current Selection-era changes, and documented a safer rebuild route for Stage 20-22 capabilities |
| 29 | Stage 19 preprocess reliability hardening | Completed | Added per-batch local fallback so remote preprocess failures no longer stop the whole wordbook job |
| 30 | Multi-endpoint remote failover | Completed | Added primary-plus-fallback OpenAI-compatible endpoints, settings-panel editing, and provider-level remote failover |

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
- [x] S16-01 Add provider-side preprocess candidate selection contracts, prompts, and response normalization.
- [x] S16-02 Route file preprocessing through a raw candidate pool plus remote candidate selection before batch wordbook generation.
- [x] S16-03 Add regression coverage for remote selection normalization and the new 5-step preprocess flow.
- [x] S16-04 Produce the Stage 16 summary file.
- [x] S17-01 Keep source-editor monitoring stable when the user clicks inside the explanation panel.
- [x] S17-02 Retune wordbook candidate retention to 100% / 85% / 70% for beginner / intermediate / expert.
- [x] S17-03 Process wordbook entries in fast prioritized chunks with partial cache writes.
- [x] S17-04 Split the panel into explanation and wordbook pages and remove suggested-question chips.
- [x] S17-05 Produce the Stage 17 summary file.
- [x] S18-01 Render the full current-file wordbook instead of truncating the visible list.
- [x] S18-02 Stop placeholder-like preprocess entries from being persisted or reused as completed cache results.
- [x] S18-03 Clarify preprocess progress semantics by separating candidate pool, selected target, cached entries, and processed batches.
- [x] S18-04 Sanitize legacy placeholder wordbook cache entries when reopening a file.
- [x] S18-05 Produce the Stage 18 summary file.
- [x] S19-01 Stop showing batch counters during candidate selection and preparation.
- [x] S19-02 Include class-member function references such as `self.xxx(...)` in the wordbook candidate pool.
- [x] S19-03 Group visible wordbook entries into a compact collapsible class/function tree.
- [x] S19-04 Add regression coverage for member extraction, scope annotation, and selection-phase batch semantics.
- [x] S19-05 Produce the Stage 19 summary file.
- [x] S20-01 Include qualified dotted-call symbols such as `Parameter` and `empty` in the wordbook candidate pool.
- [x] S20-02 Add a top-of-page current-selection focus card and basic markdown rendering for explanation surfaces.
- [x] S20-03 Remove the `Glossary Snapshot` block and stop sending its unused panel payload.
- [x] S20-04 Review project polish, apply small cleanup, and produce the Stage 20 summary file.
- [x] S21-01 Upgrade glossary generation to a hybrid regex + LSP document-symbol pipeline with cache-version invalidation.
- [x] S21-02 Propagate local/external origin metadata and scope paths through preprocessing, provider normalization, and cache reuse.
- [x] S21-03 Split the wordbook into `File Symbols` and `Library / API Symbols` layers and add term search plus current-class/current-function filtering.
- [x] S21-04 Persist wordbook tree expansion state, active tab, and wordbook controls per file inside the webview state cache.
- [x] S21-05 Add regression coverage for merged glossary metadata, document-structure conversion, and preprocess candidate metadata, then produce the Stage 21 summary file.
- [x] S22-01 Harden the explanation-panel webview so button bindings, ready signaling, and auto-watch survive script/runtime failures.
- [x] S22-02 Add `builderVersion` invalidation to preprocess caches so stale wordbook entries stop leaking across structural upgrades.
- [x] S22-03 Add TypeScript AST-backed external symbol extraction for aliased imports, decorators, chained calls, and imported constructors.
- [x] S22-04 Expand Python external symbol coverage for aliased imports, decorators, and direct imported-alias calls.
- [x] S22-05 Add large-wordbook mitigation with lazy tree rendering and a `Near selection` scope filter, then produce the Stage 22 summary file.
- [x] S27-01 Identify the last known usable version from git history and confirm `Stage 22` (`5dedc4f`) as the rollback baseline.
- [x] S27-02 Revert `Stage 23-26` so the repository returns to the Stage 22 code baseline.
- [x] S27-03 Verify the rollback baseline with compile and test.
- [x] S27-04 Document the post-Stage-22 feature delta and a replacement implementation route for reintroducing those capabilities more safely.
- [x] S28-01 Confirm that `Current Selection` first appeared in Stage 20 and lock `Stage 19` (`650fc81`) as the new stable baseline.
- [x] S28-02 Pull the Stage 19 code snapshot directly from git history instead of layering more revert logic on top of the current runtime state.
- [x] S28-03 Verify the restored Stage 19 baseline with compile and test.
- [x] S28-04 Document the Stage 20-22 feature delta and a replacement route for rebuilding those capabilities without reintroducing the unstable Current Selection-era code.
- [x] S29-01 Diagnose the Stage 19 preprocess freeze and confirm that a single failed remote chunk aborts the full job.
- [x] S29-02 Add per-chunk local fallback so preprocessing continues after a non-abort remote batch failure.
- [x] S29-03 Add regression coverage for mixed remote/local chunk completion and verify compile plus tests.
- [x] S29-04 Produce the Stage 29 summary file.
- [x] S30-01 Add configuration support for multiple OpenAI-compatible endpoints with per-endpoint base URL, API key env var, and optional model override.
- [x] S30-02 Update the provider to fail over across remote endpoints before giving up to the local fallback path.
- [x] S30-03 Expose fallback endpoints in the settings panel and add regression coverage for remote endpoint failover.
- [x] S30-04 Restore the user's local dev env so the original endpoint stays primary and the new endpoint is available as fallback without committing secrets.
- [x] S30-05 Produce the Stage 30 summary file.

## Current Todo

- [ ] Rebuild Stage 20 capabilities without reintroducing the top-of-page Current Selection card; keep qualified-call extraction but use lighter inline selection context.
- [ ] Rebuild Stage 21 capabilities behind isolated helper modules so LSP layering and wordbook filtering do not increase `src/extension.ts` focus-state complexity.
- [ ] Rebuild Stage 22 capabilities with panel hardening and scalable extraction, but keep panel state orchestration outside the webview rendering path.
- [ ] Add a dedicated controller for source editor session state before reintroducing any post-Stage-19 panel/watch/runtime behavior.

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
- A Stage 16 update moved remote file-wordbook selection away from fixed local term lists and into a dedicated provider pass over the raw candidate pool, while preserving local fallback behavior.
- A Stage 17 update stabilized monitoring when the user interacts with the panel, widened default wordbook retention, and switched wordbook preprocessing to prioritized fast chunks with a separate wordbook page in the UI.
- A Stage 18 update fixed wordbook cache integrity by preventing placeholder entries from masquerading as completed results, showing the full wordbook tab, cleaning legacy caches on load, and clarifying progress counts.
- A Stage 19 update hid misleading selection-phase batch counters, added class-member method extraction, and turned the wordbook page into a compact collapsible scope tree.
- A Stage 20 update widened preprocessing to qualified API call symbols, highlighted the current selection at the top of the explanation page, added basic markdown rendering, and removed the now-unused glossary snapshot block.
- A Stage 21 update moved glossary generation to a hybrid regex + LSP structure pipeline, carried symbol origin/scope metadata through the wordbook cache, and upgraded the wordbook tab into a layered searchable tree with per-file persisted expand state.
- A Stage 22 update hardened the panel webview against script regressions, versioned preprocess caches, added TS AST-backed external extraction plus deeper Python alias/decorator coverage, and reduced large-wordbook rendering cost with lazy tree hydration and near-selection filtering.
- After Stage 22, the repository temporarily added these feature groups before they were rolled back:
  - Stage 23: source editor isolation and auto-explain stabilization
  - Stage 24: settings navigation and preprocess visibility polish
  - Stage 25: panel ready-time resync and tighter wordbook/progress syncing
  - Stage 26: watch/reveal state split and extra wordbook diagnostics
- Stage 27 intentionally rolls the codebase back to the Stage 22 baseline because the post-Stage-22 fixes concentrated too much runtime state management inside `src/extension.ts`, which made the panel, selection watch, and wordbook flows fragile under real VS Code focus changes.
- Stage 28 moves the baseline back further to Stage 19 because Stage 20 introduced the Current Selection card and related explanation-surface changes, and the user confirmed all versions containing that UI line are unusable in practice.
- The replacement route after Stage 28 is to rebuild only the needed Stage 20-22 capabilities on top of Stage 19, with a dedicated controller for panel/watch/preprocess orchestration and without reviving the Current Selection-era explanation surface.
- A Stage 29 reliability fix keeps Stage 19 preprocessing moving even when one remote wordbook batch times out, returns empty content, or otherwise fails mid-run.
- A Stage 30 reliability upgrade adds ordered remote endpoint failover, so transient primary endpoint failures no longer force an immediate drop to local-only behavior.
- The existing `LICENSE` is MPL-2.0. The user's desired "non-commercial + attribution required" policy is not equivalent to a standard OSI open-source license and remains a future licensing decision point.
- Code comments inside the repository should use English by default.
- Local VS Code debug files under `.vscode/` remain git-ignored so secrets do not reach the repository.
