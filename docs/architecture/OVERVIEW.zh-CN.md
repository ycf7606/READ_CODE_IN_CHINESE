# 模块概览

[English](OVERVIEW.md) · [简体中文](OVERVIEW.zh-CN.md) · [架构说明](../ARCHITECTURE.zh-CN.md)

## 激活与流程编排

### `src/extension.ts`

负责注册命令和编辑器监听器、创建工作区服务、构建解释请求、更新界面状态，并协调：

- 选区解释和文件解释；
- 术语表刷新与工作区索引；
- 知识导入和官方文档同步；
- 文件预处理缓存查询与构建；
- 首次引导、设置、日志和追问；
- 模型回退和用户可见错误处理。

源编辑器身份、任务取消和选区去重等状态交给 `src/runtime/`，使异步行为可以独立测试。

## 运行时与分析

### `src/runtime/`

`sourceEditorSession.ts` 管理当前源编辑器、每种流程的唯一活动任务、单调递增任务版本、取消清理、选区去重和最近阅读优先级。它不依赖 VS Code 运行时。

### `src/analysis/`

| 模块 | 职责 |
| --- | --- |
| `glossary.ts` | 提取符号、赋值、成员调用和标签类词语 |
| `selectionInsight.ts` | 判断符号类型/来源、解析 Python 别名、压缩文档 |
| `preprocessPolicy.ts` | 执行触发、信任、大小和排除规则 |
| `explanationPostprocess.ts` | 附加一次精简的文档依据 |
| `symbolContext.ts` | 构建有边界的定义/引用上下文和哈希 |
| `wordbook.ts` | 推断类与函数作用域，用于词典分组 |
| `summary.ts` | 判断解释粒度并生成本地摘要 |

### `src/vscode/`

`selectionInspector.ts` 封装悬停和定义提供器访问。它会把点式选区移动到最后一个成员，尽量区分工作区定义和已安装库，并限制查询耗时。

## 模型与知识

### `src/providers/`

- `localProvider.ts`：零依赖的本地启发式解释引擎。
- `openAICompatibleProvider.ts`：远程解释、追问、提示词画像生成、候选选择和端点故障转移。
- `createProvider.ts`：根据设置和环境变量解析实际模型。

### `src/knowledge/`

| 模块 | 职责 |
| --- | --- |
| `knowledgeStore.ts` | 导入、保存和检索工作区文档 |
| `officialDocs.ts` | 下载并切分预设参考页面 |
| `preprocessStore.ts` | 持久化文件级词典批次 |
| `preprocessFingerprint.ts` | 版本化构建器和模型/用户画像输入 |
| `symbolPreprocessBuilder.ts` | 选择、排序、处理和复用文件符号 |
| `tokenKnowledgeStore.ts` | 保存身份隔离的重复 Token 解释 |
| `tokenKnowledgeBuilder.ts` | 保留旧版 Token 预构建兼容路径 |

## 界面、存储与日志

### `src/ui/`

- `glossaryTreeProvider.ts`：Explorer 术语树和编辑。
- `explanationPanel.ts`：解释/词典页面、选区信息、安全渲染、进度、作用域树和追问。
- `settingsPanel.ts`：首次引导、模型、用户画像、预处理、提示词生成和超参数设置。

### `src/storage/`

定义工作区缓存路径和 JSON 持久化工具。

### `src/logging/`

`logger.ts` 把诊断写入 **Read Code In Chinese** 输出通道和 Extension Host 控制台。
