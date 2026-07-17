# 开发与测试

[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-CN.md) · [文档中心](../README.zh-CN.md)

## 环境要求

- Node.js 和 npm
- VS Code 1.89 或更高版本
- 下方 PowerShell 示例使用 `npm.cmd`，便于在 Windows 中稳定执行

## 安装与编译

```powershell
npm.cmd install
npm.cmd run compile
```

修改 TypeScript 时可运行 `npm.cmd run watch`。

## 在 VS Code 中运行

1. 使用 VS Code 打开仓库。
2. 安装依赖并编译。
3. 按 `F5` 启动 Extension Development Host。
4. 完成首次启动设置。
5. 打开源文件，执行 **Read Code In Chinese: Open Conversation Panel**。
6. 分别选中变量、函数和库调用，确认解释维度不同。
7. 如果实际模型不符合预期，执行 **Read Code In Chinese: Show Logs**。

测试远程模型时，可以把环境变量默认值放入被忽略的 `.vscode/.env`，或在启动 VS Code 的终端中设置。不要提交 API Key。

## 验证命令

| 命令 | 覆盖范围 |
| --- | --- |
| `npm.cmd run check` | 只做 TypeScript 类型检查，不生成文件 |
| `npm.cmd test` | 编译并运行单元测试 |
| `npm.cmd run test:extension` | 真实 VS Code Extension Host 冒烟测试 |
| `npm.cmd run test:all` | 单元测试和 Extension Host 测试 |
| `npm.cmd run vscode:prepublish` | 发布前编译 |

使用本机已有 VS Code 运行 Extension Host 测试：

```powershell
$env:VSCODE_EXECUTABLE_PATH="E:\Microsoft VS Code\Code.exe"
npm.cmd run test:extension
```

如果不设置 `VSCODE_EXECUTABLE_PATH`，测试器会把 VS Code 1.89.1 下载到 `.vscode-test/`。

可选的 VSIX 打包命令：

```powershell
npx.cmd @vscode/vsce package
```

## 测试层级

- 纯单元测试覆盖分析逻辑、提示词、缓存、模型适配器和运行时会话生命周期。
- Extension Host 冒烟测试覆盖 VS Code 中的激活、命令注册、编辑器交互和预处理安全策略。
- 手动交互检查应覆盖焦点保持、暂停/恢复、过期任务取消、加载状态、文件词典进度和追问控件。

验证策略见[测试体系](../architecture/TESTING.zh-CN.md)。

## 项目规则

- 源代码注释使用英文。
- 优先拆分小模块，避免继续扩大 `src/extension.ts`。
- 中文解释保持精简和结构化。
- 保留工作区级缓存和隐私限制。
- 英文与中文文档应同步更新。
- 用户可见变化写入 [CHANGELOG.md](../../CHANGELOG.md)。
