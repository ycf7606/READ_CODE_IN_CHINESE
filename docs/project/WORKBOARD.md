# Project Workboard

## Context Load Order

Every future work session must read these files in order before making changes:

1. `D:\project\代码翻译\后续开发Prompt.md`
2. `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
3. The latest file under `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\summaries\`
4. Any stage baseline file directly referenced by the workboard

## Current Status

- Repository: `D:\project\代码翻译\READ_CODE_IN_CHINESE`
- Active stage: Complete
- Latest completed milestone: Stage 7
- Latest summary: `docs/project/summaries/2026-04-13-stage-7.md`
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

## Current Todo

- [ ] No open implementation tasks in the current delivery scope.

## Open Decisions Locked for Now

- Use a staged implementation instead of building all six explanation granularities at once.
- Use local static analysis and cache first; retrieval augmentation comes later.
- Treat file-level glossary as the first stable cache scope.
- Keep explanation output structured and short by default.
- Keep the explanation panel as the primary lightweight interaction surface.

## Notes

- The core extension workflow is implemented end-to-end and validated by compile plus unit tests.
- The existing `LICENSE` is MPL-2.0. The user's desired "non-commercial + attribution required" policy is not equivalent to a standard OSI open-source license and remains a future licensing decision point.
- Code comments inside the repository should use English by default.
