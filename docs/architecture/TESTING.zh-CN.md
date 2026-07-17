# 测试体系

[English](TESTING.md) · [简体中文](TESTING.zh-CN.md) · [架构说明](../ARCHITECTURE.zh-CN.md)

项目采用分层验证，因为纯分析测试无法证明编辑器焦点、命令注册和 Webview 集成在真实 VS Code 中正确运行。

## 自动化层级

| 层级 | 命令 | 覆盖范围 |
| --- | --- | --- |
| 类型检查 | `npm.cmd run check` | TypeScript 契约和编译期集成 |
| 单元测试 | `npm.cmd test` | 分析、提示词、模型、缓存和运行时生命周期 |
| Extension Host | `npm.cmd run test:extension` | 激活和真实 VS Code 编辑器/命令行为 |
| 综合验证 | `npm.cmd run test:all` | 单元测试和 Extension Host 测试 |

当前基线包含 41 项单元测试和 Extension Host 冒烟测试。

## 高风险回归点

- 过期解释或错误不能覆盖更新后的选区。
- 点击面板不能丢失当前跟踪的源编辑器。
- 暂停/恢复和重新生成必须使用当前源代码选区。
- 变量和函数必须构建不同的解释维度。
- Python 限定导入和别名解析不能执行第三方包。
- 同名 API 不能共享不兼容缓存。
- 未保存编辑必须取消预处理并阻止过期写入。
- 预处理必须遵守信任、排除、大小和触发模式。
- Webview 内容必须安全渲染，控件必须正确反映加载状态。
- 主端点和备用端点必须按预期故障转移。

## 手动交互检查

1. 按 `F5` 启动 Extension Development Host。
2. 在源文件旁打开对话面板。
3. 分别选中变量、函数、类和库 API。
4. 确认自动更新时源编辑器保持焦点。
5. 请求运行时快速切换选区，最终只能显示最新结果。
6. 测试暂停跟随、切换选区、恢复和重新生成。
7. 运行文件预处理，检查阶段名称和计数。
8. 预处理期间编辑文件，确认过期任务停止。
9. 解释完成后再测试追问。
10. 在 **Read Code In Chinese** 日志中检查模型与回退细节。

## 打包检查

发布候选版本应能编译并生成 VSIX：

```powershell
npm.cmd run vscode:prepublish
npx.cmd @vscode/vsce package
```

应检查打包内容，确保密钥、本地缓存、测试下载和开发专用文件没有进入包。
