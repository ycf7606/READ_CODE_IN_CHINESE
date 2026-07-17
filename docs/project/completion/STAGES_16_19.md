# Completion Archive: Stages 16–19

[Completion index](../COMPLETION_LOG.md) · [Stage index](../STAGE_INDEX.md)

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
