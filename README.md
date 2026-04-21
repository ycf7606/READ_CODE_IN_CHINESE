# READ_CODE_IN_CHINESE

VS Code extension for reading source code in concise Chinese with:

- structured explanations for the current selection
- file-level wordbook preprocessing for local symbols
- optional OpenAI-compatible remote inference
- workspace glossary and knowledge retrieval
- follow-up chat in the same panel

## Version

Current release baseline: `v0.1.2`

Remote wordbook preprocessing is now strict by default:

- all file-local preprocess candidates are sent to the remote provider
- the wordbook first lists selected candidates, then tracks each term as pending, processing, succeeded, or failed
- failed wordbook terms can be retried without rebuilding successful items
- the UI shows whether remote inference was actually verified
- fallback endpoints can be retried automatically when the primary endpoint fails

## Main Commands

- `Read Code In Chinese: Explain Selection`
- `Read Code In Chinese: Explain Current File`
- `Read Code In Chinese: Open Conversation Panel`
- `Read Code In Chinese: Preprocess Current File Symbols`
- `Read Code In Chinese: Refresh Glossary`
- `Read Code In Chinese: Generate Workspace Index`
- `Read Code In Chinese: Import Knowledge Documents`
- `Read Code In Chinese: Sync Official Docs For Active Language`
- `Read Code In Chinese: Open Settings Panel`
- `Read Code In Chinese: Show Logs`

## Provider Setup

### Local Mode

Set:

- `readCodeInChinese.provider.id = local`

This mode does not require API keys.

### OpenAI-Compatible Mode

Set:

- `readCodeInChinese.provider.id = openai-compatible`
- `readCodeInChinese.provider.baseUrl`
- `readCodeInChinese.provider.model`
- `readCodeInChinese.provider.apiKeyEnvVar`

Environment:

```powershell
$env:READ_CODE_IN_CHINESE_API_KEY="your-api-key"
```

Optional fallback endpoints:

```powershell
$env:READ_CODE_IN_CHINESE_PROVIDER_FALLBACKS='[
  {"baseUrl":"https://fallback.example.com/v1","model":"gpt-5.4","apiKeyEnvVar":"READ_CODE_IN_CHINESE_API_KEY_FALLBACK"}
]'
```

## Important Settings

- `readCodeInChinese.provider.reasoningEffort`
- `readCodeInChinese.provider.timeoutMs`
- `readCodeInChinese.provider.temperature`
- `readCodeInChinese.provider.topP`
- `readCodeInChinese.provider.maxTokens`
- `readCodeInChinese.preprocess.includeAllCandidates`
- `readCodeInChinese.explanation.detailLevel`
- `readCodeInChinese.explanation.professionalLevel`
- `readCodeInChinese.explanation.occupation`
- `readCodeInChinese.explanation.sections`
- `readCodeInChinese.explanation.userGoal`
- `readCodeInChinese.prompt.customInstructions`
- `readCodeInChinese.knowledge.topK`

## Wordbook Preprocessing

The wordbook cache is stored under:

```text
.read-code-in-chinese/preprocess/
```

Behavior:

- the active file is scanned for user-defined variables, functions, classes, types, and label-like strings
- custom function names from arrow functions, function expressions, object methods, and class methods are included
- preprocessing uses full-file context
- default mode preprocesses all file-local candidates
- setting `readCodeInChinese.preprocess.includeAllCandidates = false` switches back to audience-filtered selection
- incomplete remote batches are marked as failed so they can be retried from the wordbook page
- cache metadata records selection mode, selection source, inference source, remote-verification state, and per-term statuses
- incomplete remote batches fail immediately instead of writing partial “successful” cache entries
- cache metadata records selection mode, selection source, inference source, and remote-verification state

## Knowledge Import

Supported import formats:

- `.md`
- `.txt`
- `.json`

See [IMPORTING_KNOWLEDGE.md](/D:/project/代码翻译/READ_CODE_IN_CHINESE/docs/knowledge/IMPORTING_KNOWLEDGE.md).

## Development

Install:

```powershell
npm.cmd install
```

Compile:

```powershell
npm.cmd run compile
```

Test:

```powershell
npm.cmd test
```

Real remote wordbook smoke:

```powershell
npm.cmd run smoke:preprocess
```

Run in VS Code:

1. Open the repository in VS Code.
2. Put provider variables in `.vscode/.env` if you want remote testing.
3. Run `npm.cmd install`.
4. Press `F5`.
5. Open the settings panel and confirm the provider.
6. Run `Read Code In Chinese: Preprocess Current File Symbols`.
7. Check the explanation panel for `Selection mode`, `Inference source`, and `Remote inference verified`.

## Repository Layout

- `src/extension.ts`: command wiring and runtime orchestration
- `src/analysis/`: glossary extraction, summary heuristics, and wordbook scope analysis
- `src/providers/`: local and OpenAI-compatible providers
- `src/knowledge/`: knowledge import, official docs sync, preprocess cache, token cache
- `src/ui/`: explanation panel, settings panel, glossary tree
- `src/test/index.test.ts`: regression tests
- `docs/ARCHITECTURE.md`: compact architecture overview

## License

`MPL-2.0`
