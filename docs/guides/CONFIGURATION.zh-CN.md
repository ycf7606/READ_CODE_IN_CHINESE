# 配置说明

[English](CONFIGURATION.md) · [简体中文](CONFIGURATION.zh-CN.md) · [文档中心](../README.zh-CN.md)

常用配置可以通过 **Read Code In Chinese: Open Settings Panel** 修改，也都可以直接写入 VS Code 设置。

## 模型模式

### 本地模式

将 `readCodeInChinese.provider.id` 设为 `local`。

- 不需要 API Key，也不会发起模型网络请求。
- 仍可使用已经导入的工作区知识。
- 这是默认模式，也是可信远程模型不可用时的回退方案。

### OpenAI 兼容模式

将 `readCodeInChinese.provider.id` 设为 `openai-compatible`，然后配置接口地址、模型和 API Key 环境变量名。

```powershell
$env:READ_CODE_IN_CHINESE_API_KEY="your-api-key"
```

插件读取 `readCodeInChinese.provider.apiKeyEnvVar` 指定的环境变量，不会把密钥本身保存到 VS Code 设置。

备用端点由 `baseUrl`、`apiKeyEnvVar` 和可选的 `model` 组成：

```json
[
  {
    "baseUrl": "https://backup.example.com/v1",
    "apiKeyEnvVar": "READ_CODE_IN_CHINESE_BACKUP_KEY",
    "model": "your-backup-model"
  }
]
```

## 设置索引

### 交互

| 设置 | 默认值 | 用途 |
| --- | ---: | --- |
| `readCodeInChinese.autoExplain.enabled` | `false` | 选区变化后自动解释 |
| `readCodeInChinese.autoExplain.delayMs` | `600` | 自动解释防抖时间（毫秒） |
| `readCodeInChinese.ui.autoOpenPanel` | `true` | 手动解释后显示面板 |

### 模型

| 设置 | 默认值 | 用途 |
| --- | ---: | --- |
| `readCodeInChinese.provider.id` | `local` | `local` 或 `openai-compatible` |
| `readCodeInChinese.provider.baseUrl` | 空 | 主接口地址 |
| `readCodeInChinese.provider.model` | 空 | 主模型名称 |
| `readCodeInChinese.provider.apiKeyEnvVar` | `READ_CODE_IN_CHINESE_API_KEY` | 保存密钥的环境变量名 |
| `readCodeInChinese.provider.fallbacks` | `[]` | 按顺序尝试的备用端点 |
| `readCodeInChinese.provider.timeoutMs` | `20000` | 请求超时 |
| `readCodeInChinese.provider.temperature` | `0.2` | 采样温度 |
| `readCodeInChinese.provider.topP` | `1` | Top-p 采样值 |
| `readCodeInChinese.provider.maxTokens` | `1200` | 最大响应 Token 数 |
| `readCodeInChinese.provider.reasoningEffort` | `medium` | `low`、`medium`、`high` 或 `xhigh` |
| `readCodeInChinese.provider.requireTrustedWorkspace` | `true` | 不受信任工作区禁止远程调用 |

### 解释输出

| 设置 | 默认值 | 用途 |
| --- | ---: | --- |
| `readCodeInChinese.explanation.detailLevel` | `balanced` | `fast`、`balanced` 或 `deep` |
| `readCodeInChinese.explanation.professionalLevel` | `intermediate` | `beginner`、`intermediate` 或 `expert` |
| `readCodeInChinese.explanation.occupation` | `developer` | 用户职业画像 |
| `readCodeInChinese.explanation.sections` | `summary, usage` | 偏好的解释区块 |
| `readCodeInChinese.explanation.userGoal` | 空 | 可选的学习或审查目标 |
| `readCodeInChinese.prompt.customInstructions` | 空 | 解释和追问共用的全局要求 |
| `readCodeInChinese.knowledge.topK` | `3` | 最多附加的知识片段数量 |

预处理配置单独整理在[预处理与缓存](PREPROCESSING.zh-CN.md)。

## 环境变量默认值

Extension Development Host 在 VS Code 设置未显式配置时，可以读取 `READ_CODE_IN_CHINESE_*` 环境变量。常见变量包括：

- `READ_CODE_IN_CHINESE_PROVIDER_ID`
- `READ_CODE_IN_CHINESE_PROVIDER_BASE_URL`
- `READ_CODE_IN_CHINESE_PROVIDER_MODEL`
- `READ_CODE_IN_CHINESE_PROVIDER_API_KEY_ENV_VAR`
- `READ_CODE_IN_CHINESE_PROVIDER_FALLBACKS`
- `READ_CODE_IN_CHINESE_PROVIDER_TIMEOUT_MS`
- `READ_CODE_IN_CHINESE_EXPLANATION_PROFESSIONAL_LEVEL`
- `READ_CODE_IN_CHINESE_PREPROCESS_MODE`

使用 **Read Code In Chinese: Show Logs** 可以确认实际模型、端点可用性和回退结果。不要把本地密钥提交到仓库。
