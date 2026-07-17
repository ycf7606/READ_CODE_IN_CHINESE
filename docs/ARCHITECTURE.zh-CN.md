# 架构说明

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [文档中心](README.zh-CN.md)

插件组合了本地分析、VS Code 语言服务、工作区缓存、可选知识检索以及本地或远程解释模型。

## 架构导航

| 文档 | 重点 |
| --- | --- |
| [模块概览](architecture/OVERVIEW.zh-CN.md) | 模块边界与职责 |
| [运行流程](architecture/RUNTIME.zh-CN.md) | 选区生命周期、任务取消和模型执行 |
| [缓存与数据流](architecture/CACHE_AND_DATA_FLOW.zh-CN.md) | 存储结构、查询顺序和失效规则 |
| [测试体系](architecture/TESTING.zh-CN.md) | 单元测试、Extension Host 和手动交互覆盖 |

## 核心设计原则

- 解释当前代码上下文，而不是只给出通用词义。
- 对变量、函数、类型、模块和库 API 使用不同解释维度。
- 远程调用前优先使用快速本地结果和兼容缓存。
- 过期任务不能覆盖较新的编辑器状态。
- 远程预处理必须显式、有限，并遵守工作区信任设置。
- 通过语言服务复用文档，不导入或执行第三方包。
- 中文输出保持精简和结构化。
- Webview 保持低干扰、不抢焦点，并避免直接注入 HTML。
- 同时验证纯逻辑和真实 VS Code 集成。

## 顶层模块

| 区域 | 职责 |
| --- | --- |
| `src/extension.ts` | 激活、命令注册、流程编排和服务协调 |
| `src/runtime/` | 源编辑器跟踪、任务版本、取消和阅读优先级 |
| `src/analysis/` | 选区语义、术语提取、上下文构建和摘要 |
| `src/vscode/` | 有时限的悬停与定义信息查询 |
| `src/providers/` | 本地与 OpenAI 兼容模型适配 |
| `src/knowledge/` | 检索、官方文档、预处理和 Token 缓存 |
| `src/storage/` | 工作区路径和 JSON 持久化 |
| `src/ui/` | 术语树、解释面板和设置面板 |
| `src/logging/` | VS Code 输出通道诊断 |
