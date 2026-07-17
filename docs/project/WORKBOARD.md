# Project Workboard

[English](WORKBOARD.md) · [简体中文](WORKBOARD.zh-CN.md) · [Documentation](../README.md)

## Current Status

| Item | Value |
| --- | --- |
| Active milestone | Complete — Stage 34 bilingual documentation reorganization |
| Product baseline | Stage 33 |
| Latest product summary | [Stage 33](summaries/2026-07-17-stage-33.md) |
| Current documentation summary | [Stage 34](summaries/2026-07-17-stage-34.md) |
| Test baseline | 41 unit tests plus VS Code Extension Host smoke coverage |
| Branch | `main` |

## Start Here for Future Work

1. Read this workboard.
2. Read the latest file in [stage summaries](summaries/).
3. Use the [stage index](STAGE_INDEX.md) when older context is required.
4. Use the [completion log](COMPLETION_LOG.md) only for task-level historical detail.
5. Read the relevant guide or [architecture page](../ARCHITECTURE.md) before changing behavior.

## Current Todo

No open tasks. Start the next milestone from the documentation and test baseline recorded here.

## Stable Decisions

- Source comments remain in English.
- User-facing explanations remain concise Chinese.
- `README.md` and canonical documentation filenames default to English.
- Chinese mirrors use the `.zh-CN.md` suffix.
- Local caches and lightweight analysis are preferred before remote calls.
- Imported knowledge and generated caches remain workspace-scoped.
- Remote preprocessing stays opt-in by default and obeys trust, exclusion, and size gates.
- API keys remain in environment variables and are never committed.
- New behavior must preserve stale-task cancellation and source-editor focus.
- User-visible behavior changes require tests and matching English/Chinese documentation updates.

## Tracking Policy

- Add a stage summary for each completed milestone.
- Add task-level detail to the appropriate completion archive only when it is useful for future debugging.
- Keep this page short; milestones belong in [STAGE_INDEX.md](STAGE_INDEX.md), not here.
- Keep release-facing changes in [CHANGELOG.md](../../CHANGELOG.md).
