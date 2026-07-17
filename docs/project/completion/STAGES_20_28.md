# Completion Archive: Stages 20–28

[Completion index](../COMPLETION_LOG.md) · [Stage index](../STAGE_INDEX.md)

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

### S27-01 Roll back to the stable Stage 22 baseline

- Stage: 27
- Result: Identified `5dedc4f` (`Stage 22`) as the last known usable version, reverted the `Stage 23-26` change range, verified the restored baseline with compile and tests, and documented both the post-Stage-22 feature delta and a safer replacement implementation route.
- Files:
  - `src/extension.ts`
  - `src/ui/explanationPanel.ts`
  - `src/ui/settingsPanel.ts`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-27.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`

### S28-01 Pull the stable Stage 19 baseline directly

- Stage: 28
- Result: Confirmed that `Current Selection` first appeared in Stage 20, pulled the Stage 19 (`650fc81`) code snapshot directly into the current branch, verified the restored baseline with compile and tests, and documented the Stage 20-22 feature delta plus the new rebuild route.
- Files:
  - `src/analysis/glossary.ts`
  - `src/analysis/preprocess.ts`
  - `src/analysis/wordbook.ts`
  - `src/contracts.ts`
  - `src/extension.ts`
  - `src/knowledge/preprocessStore.ts`
  - `src/knowledge/symbolPreprocessBuilder.ts`
  - `src/prompts/openAICompatiblePrompt.ts`
  - `src/providers/localProvider.ts`
  - `src/providers/openAICompatibleProvider.ts`
  - `src/test/index.test.ts`
  - `src/ui/explanationPanel.ts`
  - `src/ui/settingsPanel.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/ARCHITECTURE.md`
  - `docs/project/WORKBOARD.md`
  - `docs/project/COMPLETION_LOG.md`
  - `docs/project/summaries/2026-04-15-stage-28.md`
- Verification:
  - `cmd /c npm.cmd run compile`
  - `cmd /c npm.cmd test`
