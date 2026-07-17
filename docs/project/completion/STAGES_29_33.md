# Completion Archive: Stages 29–33

[Completion index](../COMPLETION_LOG.md) · [Stage index](../STAGE_INDEX.md)

### S29-01 Harden Stage 19 preprocess against mid-run remote batch failures

- Stage: 29
- Result: Diagnosed that Stage 19 preprocessing could stop halfway because each remote wordbook chunk was required to succeed; added per-chunk local fallback so a non-abort remote failure no longer aborts the full job, and verified the mixed remote/local path with a regression test.
- Files:
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/test/index.test.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-29.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S30-01 Add multi-endpoint remote failover and restore local provider chain

- Stage: 30
- Result: Added support for multiple OpenAI-compatible endpoints with ordered failover in the provider, surfaced fallback endpoint editing in the settings panel, added a regression test for remote failover, and restored the local dev env so the original endpoint is primary and the new endpoint is available as fallback without committing secrets.
- Files:
  - `package.json`
  - `src/contracts.ts`
  - `src/config.ts`
  - `src/extension.ts`
  - `src/providers/createProvider.ts`
  - `src/providers/openAICompatibleProvider.ts`
  - `src/ui/settingsPanel.ts`
  - `src/test/index.test.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-30.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S31-01 Extract and harden the source editor session lifecycle

- Stage: 31
- Result: Moved tracked-editor fallback, task versioning, cancellation, automatic-selection deduplication, and recent-reading priority state out of `src/extension.ts` into a pure controller. Canceled tasks are invalidated before abort propagation, stale follow-up and preprocess errors are dropped before UI updates, and extension disposal now clears pending timers and tasks.
- Files:
  - `src/runtime/sourceEditorSession.ts`
  - `src/extension.ts`
  - `src/test/index.test.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-07-16-stage-31.md`
- Verification:
  - `npm.cmd run check`
  - `npm.cmd test`

### S32-01 Add selection-aware explanations and harden the VS Code interaction flow

- Stage: 32
- Result: Added variable/function-specific selection semantics, Python import alias and built-in detection, concise language-service documentation evidence, bounded preprocess context with symbol-level cache reuse, and a compact Chinese explanation panel. Rapid selection changes now cancel immediately and validate task currency after hover, glossary, cache, and provider stages so obsolete state cannot reappear.
- Files:
  - `src/contracts.ts`
  - `src/analysis/selectionInsight.ts`
  - `src/analysis/explanationPostprocess.ts`
  - `src/analysis/symbolContext.ts`
  - `src/vscode/selectionInspector.ts`
  - `src/runtime/sourceEditorSession.ts`
  - `src/extension.ts`
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/prompts/openAICompatiblePrompt.ts`
  - `src/providers/localProvider.ts`
  - `src/providers/openAICompatibleProvider.ts`
  - `src/ui/explanationPanel.ts`
  - `src/test/index.test.ts`
  - `.vscodeignore`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-07-16-stage-32.md`
- Verification:
  - `npm.cmd run check`
  - `npm.cmd test` (35/35 passed)
  - `git diff --check`
  - `npx.cmd --yes @vscode/vsce package --no-dependencies`

### S33-01 Make remote preprocessing and repeated-symbol caches correctness-first

- Stage: 33
- Result: Replaced term-only token cache matching with qualified/callsite identities, made remote preprocessing explicit and privacy-gated, canceled work on unsaved edits, added fair scope-aware context and provider/audience build fingerprints, and introduced a real VS Code Extension Host smoke suite.
- Files:
  - `package.json`
  - `package-lock.json`
  - `.github/workflows/ci.yml`
  - `.gitignore`
  - `.vscodeignore`
  - `src/contracts.ts`
  - `src/config.ts`
  - `src/extension.ts`
  - `src/analysis/preprocessPolicy.ts`
  - `src/analysis/selectionInsight.ts`
  - `src/analysis/symbolContext.ts`
  - `src/knowledge/preprocessFingerprint.ts`
  - `src/knowledge/preprocessStore.ts`
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/knowledge/tokenKnowledgeStore.ts`
  - `src/vscode/selectionInspector.ts`
  - `src/ui/settingsPanel.ts`
  - `src/test/index.test.ts`
  - `src/test/runExtensionTests.ts`
  - `src/test/vscode/suite/index.ts`
  - `src/test/fixtures/workspace/sample.py`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-07-17-stage-33.md`
- Verification:
  - `npm.cmd run check`
  - `npm.cmd test` (41/41 passed)
  - `npm.cmd run test:extension` with VS Code 1.105.0
  - `git diff --check`
  - `npx.cmd --yes @vscode/vsce package --no-dependencies`
