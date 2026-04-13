# Project Workboard

## Context Load Order

Every future work session must read these files in order before making changes:

1. `D:\project\代码翻译\后续开发Prompt.md`
2. `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\WORKBOARD.md`
3. The latest file under `D:\project\代码翻译\READ_CODE_IN_CHINESE\docs\project\summaries\`
4. Any stage baseline file directly referenced by the workboard

## Current Status

- Repository: `D:\project\代码翻译\READ_CODE_IN_CHINESE`
- Active stage: Stage 2
- Latest completed milestone: Stage 1
- Latest summary: `docs/project/summaries/2026-04-13-stage-1.md`
- Tracking policy:
  - New work must update this file.
  - Every completed task must be appended to `docs/project/COMPLETION_LOG.md`.
  - Every stage milestone must generate a new summary file under `docs/project/summaries/`.

## Stage Progress

| Stage | Name | Status | Notes |
| --- | --- | --- | --- |
| 0 | Requirements and baseline | Completed | Baseline decisions documented |
| 1 | Minimal VS Code extension skeleton | Completed | Commands, config, compile path, placeholder execution |
| 2 | Minimal explanation loop | Todo | Selection to explanation flow |
| 3 | Glossary and consistency | Todo | File-level term cache |
| 4 | Multi-granularity explanation | Todo | Variable to repository views |
| 5 | Follow-up chat | Todo | Lightweight deep-dive flow |
| 6 | Knowledge augmentation | Todo | Documentation retrieval |
| 7 | Open-source polish | Todo | Docs, tests, release readiness |

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

## Current Todo

- [ ] S2-01 Define the explanation request and response contracts for the selection flow.
- [ ] S2-02 Add a provider adapter layer so the command path stops depending on inline placeholder logic.
- [ ] S2-03 Replace the current placeholder composition with a minimal explanation pipeline.
- [ ] S2-04 Add latency-aware error handling and user-facing progress feedback.
- [ ] S2-05 Write the Stage 2 summary file after the minimal explanation loop is complete.

## Open Decisions Locked for Now

- Use a staged implementation instead of building all six explanation granularities at once.
- Use local static analysis and cache first; retrieval augmentation comes later.
- Treat file-level glossary as the first stable cache scope.
- Keep explanation output structured and short by default.
- Prioritize VS Code native UI primitives before introducing heavier interfaces.

## Notes

- The current repository is near-empty. Stage 0 focused on converting the idea into an execution baseline instead of modifying application code.
- The existing `LICENSE` is MPL-2.0. The user's desired "non-commercial + attribution required" policy is not equivalent to a standard OSI open-source license and remains a future licensing decision point.
- Code comments inside the repository should use English by default.
