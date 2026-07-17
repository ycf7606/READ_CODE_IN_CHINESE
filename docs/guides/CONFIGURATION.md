# Configuration

[English](CONFIGURATION.md) · [简体中文](CONFIGURATION.zh-CN.md) · [Documentation](../README.md)

Open **Read Code In Chinese: Open Settings Panel** for the common options. Every value is also available through VS Code settings.

## Provider Modes

### Local

Set `readCodeInChinese.provider.id` to `local`.

- No API key or network request is required.
- Imported knowledge may still be used.
- This is the default and the fallback when a trusted remote provider is unavailable.

### OpenAI-Compatible

Set `readCodeInChinese.provider.id` to `openai-compatible`, then configure a base URL, model, and API-key environment variable.

```powershell
$env:READ_CODE_IN_CHINESE_API_KEY="your-api-key"
```

The extension reads the variable named by `readCodeInChinese.provider.apiKeyEnvVar`; the key itself is not stored in VS Code settings.

Fallback endpoints use objects with `baseUrl`, `apiKeyEnvVar`, and an optional `model`:

```json
[
  {
    "baseUrl": "https://backup.example.com/v1",
    "apiKeyEnvVar": "READ_CODE_IN_CHINESE_BACKUP_KEY",
    "model": "your-backup-model"
  }
]
```

## Settings Reference

### Interaction

| Setting | Default | Purpose |
| --- | ---: | --- |
| `readCodeInChinese.autoExplain.enabled` | `false` | Explain after selection changes |
| `readCodeInChinese.autoExplain.delayMs` | `600` | Selection debounce in milliseconds |
| `readCodeInChinese.ui.autoOpenPanel` | `true` | Reveal the panel after a manual explanation |

### Provider

| Setting | Default | Purpose |
| --- | ---: | --- |
| `readCodeInChinese.provider.id` | `local` | `local` or `openai-compatible` |
| `readCodeInChinese.provider.baseUrl` | empty | Primary chat-completions endpoint |
| `readCodeInChinese.provider.model` | empty | Primary model name |
| `readCodeInChinese.provider.apiKeyEnvVar` | `READ_CODE_IN_CHINESE_API_KEY` | Environment variable containing the key |
| `readCodeInChinese.provider.fallbacks` | `[]` | Ordered remote fallback endpoints |
| `readCodeInChinese.provider.timeoutMs` | `20000` | Request timeout |
| `readCodeInChinese.provider.temperature` | `0.2` | Sampling temperature |
| `readCodeInChinese.provider.topP` | `1` | Top-p sampling |
| `readCodeInChinese.provider.maxTokens` | `1200` | Maximum response tokens |
| `readCodeInChinese.provider.reasoningEffort` | `medium` | `low`, `medium`, `high`, or `xhigh` |
| `readCodeInChinese.provider.requireTrustedWorkspace` | `true` | Block remote use in untrusted workspaces |

### Explanation

| Setting | Default | Purpose |
| --- | ---: | --- |
| `readCodeInChinese.explanation.detailLevel` | `balanced` | `fast`, `balanced`, or `deep` |
| `readCodeInChinese.explanation.professionalLevel` | `intermediate` | `beginner`, `intermediate`, or `expert` |
| `readCodeInChinese.explanation.occupation` | `developer` | Audience profile |
| `readCodeInChinese.explanation.sections` | `summary, usage` | Preferred response sections |
| `readCodeInChinese.explanation.userGoal` | empty | Optional learning or review goal |
| `readCodeInChinese.prompt.customInstructions` | empty | Global instructions for explanations and follow-ups |
| `readCodeInChinese.knowledge.topK` | `3` | Maximum retrieved knowledge snippets |

Preprocessing settings are documented separately in [Preprocessing and Caches](PREPROCESSING.md).

## Environment Defaults

Development-host sessions may use `READ_CODE_IN_CHINESE_*` variables when a VS Code setting is not explicitly configured. Common variables include:

- `READ_CODE_IN_CHINESE_PROVIDER_ID`
- `READ_CODE_IN_CHINESE_PROVIDER_BASE_URL`
- `READ_CODE_IN_CHINESE_PROVIDER_MODEL`
- `READ_CODE_IN_CHINESE_PROVIDER_API_KEY_ENV_VAR`
- `READ_CODE_IN_CHINESE_PROVIDER_FALLBACKS`
- `READ_CODE_IN_CHINESE_PROVIDER_TIMEOUT_MS`
- `READ_CODE_IN_CHINESE_EXPLANATION_PROFESSIONAL_LEVEL`
- `READ_CODE_IN_CHINESE_PREPROCESS_MODE`

Use **Read Code In Chinese: Show Logs** to confirm the effective provider, endpoint availability, and fallback behavior. Keep local secrets out of committed files.
