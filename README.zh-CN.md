# READ_CODE_IN_CHINESE

[English](README.md) · [简体中文](README.zh-CN.md)

一款把选中源代码转换为精简中文解释的 VS Code 插件。它会先判断选中内容是变量、函数、类、模块还是库 API，再从对应维度进行解释。

## 核心亮点

- 变量侧重数据来源与流向，函数侧重职责、输入输出和副作用。
- 通过 VS Code 语言服务提取精简 Python API 文档，不导入或执行第三方包。
- 常驻面板支持解释、追问、加载状态、暂停/恢复跟随和手动重新生成。
- 文件词典按模块、类和函数作用域分组。
- 预处理默认重视隐私，受工作区信任、排除规则、文件大小和触发模式约束。
- 同时支持本地启发式引擎和 OpenAI 兼容接口，可离线使用并支持远程端点故障转移。
- 内置工作区知识导入、官方文档同步、术语编辑和工作区索引。

## 快速开始

1. 安装依赖并编译：

   ```powershell
   npm.cmd install
   npm.cmd run compile
   ```

2. 使用 VS Code 打开仓库并按 `F5`。
3. 在首次启动的设置面板中完成配置。
4. 选中代码，执行 **Read Code In Chinese: Explain Selection**。
5. 保持对话面板打开，即可自动跟随编辑器选区。

本地模式无需 API Key。远程接口设置见[配置说明](docs/guides/CONFIGURATION.zh-CN.md)。

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `Explain Selection` | 解释当前选区 |
| `Toggle Auto Explain` | 开启或关闭选区跟随 |
| `Open Conversation Panel` | 打开解释与追问面板 |
| `Explain Current File` | 概览当前文件 |
| `Preprocess Current File Symbols` | 构建可复用的文件词典 |
| `Generate Workspace Index` | 生成工作区概览报告 |
| `Import Knowledge Documents` | 导入本地参考资料 |
| `Sync Official Docs For Active Language` | 同步语言参考文档 |
| `Open Settings Panel` | 配置模型与解释输出 |
| `Show Logs` | 查看运行日志 |

默认快捷键：`Ctrl+Alt+E` 解释选区，`Ctrl+Alt+T` 切换自动解释，`Ctrl+Alt+F` 解释当前文件。

## 文档导航

| 主题 | English | 简体中文 |
| --- | --- | --- |
| 文档首页 | [Open](docs/README.md) | [打开](docs/README.zh-CN.md) |
| 功能与交互 | [Features](docs/guides/FEATURES.md) | [功能与交互](docs/guides/FEATURES.zh-CN.md) |
| 插件与接口配置 | [Configuration](docs/guides/CONFIGURATION.md) | [配置说明](docs/guides/CONFIGURATION.zh-CN.md) |
| 文件预处理与缓存 | [Preprocessing](docs/guides/PREPROCESSING.md) | [预处理与缓存](docs/guides/PREPROCESSING.zh-CN.md) |
| 本地开发与测试 | [Development](docs/guides/DEVELOPMENT.md) | [开发与测试](docs/guides/DEVELOPMENT.zh-CN.md) |
| 项目架构 | [Architecture](docs/ARCHITECTURE.md) | [架构说明](docs/ARCHITECTURE.zh-CN.md) |
| 项目进度 | [Workboard](docs/project/WORKBOARD.md) | [项目看板](docs/project/WORKBOARD.zh-CN.md) |

## 当前状态

插件完整工作流已经实现，并通过 41 项单元测试和真实 VS Code Extension Host 冒烟测试。当前基线包含选区语义识别、隐私安全预处理、身份隔离缓存、过期任务取消和远程端点故障转移。

版本变化见 [CHANGELOG.md](CHANGELOG.md)，工程阶段见[阶段索引](docs/project/STAGE_INDEX.zh-CN.md)。

## 开发验证

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:extension
```

更多命令和调试方式见[开发指南](docs/guides/DEVELOPMENT.zh-CN.md)。

## 许可证

项目采用 [MPL-2.0](LICENSE)。
