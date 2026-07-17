# READ_CODE_IN_CHINESE

[English](README.md) · [简体中文](README.zh-CN.md)

A VS Code extension that turns selected source code into concise Chinese explanations. It identifies whether a selection is a variable, function, class, module, or library API, then explains it from the right perspective.

## Highlights

- Variables focus on data flow; functions focus on behavior, inputs, outputs, and side effects.
- Concise Python API references come from VS Code language services without importing or executing packages.
- A persistent panel provides explanations, follow-up chat, loading state, pause/resume, and regeneration.
- A file wordbook groups symbols by module, class, and function scope.
- Privacy-first preprocessing applies trust, exclusion, file-size, and explicit trigger controls.
- Local heuristic and OpenAI-compatible provider modes support offline use and remote endpoint failover.
- Workspace knowledge import, official documentation sync, glossary editing, and workspace indexing are built in.

## Quick Start

1. Install dependencies and compile:

   ```powershell
   npm.cmd install
   npm.cmd run compile
   ```

2. Open the repository in VS Code and press `F5`.
3. Complete the first-run settings panel.
4. Select code and run **Read Code In Chinese: Explain Selection**.
5. Keep the conversation panel open to follow selections automatically.

The local provider works without an API key. Remote setup is covered in [Configuration](docs/guides/CONFIGURATION.md).

## Main Commands

| Command | Purpose |
| --- | --- |
| `Explain Selection` | Explain the current selection |
| `Toggle Auto Explain` | Enable or disable selection following |
| `Open Conversation Panel` | Open explanations and follow-up chat |
| `Explain Current File` | Summarize the active file |
| `Preprocess Current File Symbols` | Build the reusable file wordbook |
| `Generate Workspace Index` | Create a workspace overview report |
| `Import Knowledge Documents` | Add local reference material |
| `Sync Official Docs For Active Language` | Download reference documentation |
| `Open Settings Panel` | Configure providers and output |
| `Show Logs` | Open runtime diagnostics |

Default shortcuts: `Ctrl+Alt+E` explain, `Ctrl+Alt+T` toggle auto explain, and `Ctrl+Alt+F` explain the current file.

## Documentation

| Topic | English | 简体中文 |
| --- | --- | --- |
| Documentation home | [Open](docs/README.md) | [打开](docs/README.zh-CN.md) |
| Features and interaction | [Features](docs/guides/FEATURES.md) | [功能与交互](docs/guides/FEATURES.zh-CN.md) |
| Provider and extension settings | [Configuration](docs/guides/CONFIGURATION.md) | [配置说明](docs/guides/CONFIGURATION.zh-CN.md) |
| File preprocessing and caches | [Preprocessing](docs/guides/PREPROCESSING.md) | [预处理与缓存](docs/guides/PREPROCESSING.zh-CN.md) |
| Local development and testing | [Development](docs/guides/DEVELOPMENT.md) | [开发与测试](docs/guides/DEVELOPMENT.zh-CN.md) |
| Architecture | [Architecture](docs/ARCHITECTURE.md) | [架构说明](docs/ARCHITECTURE.zh-CN.md) |
| Project progress | [Workboard](docs/project/WORKBOARD.md) | [项目看板](docs/project/WORKBOARD.zh-CN.md) |

## Current Status

The workflow is implemented and covered by 41 unit tests plus a VS Code Extension Host smoke test. The current baseline includes selection-aware explanations, privacy-safe preprocessing, identity-safe caches, stale-task cancellation, and remote endpoint failover.

See [CHANGELOG.md](CHANGELOG.md) for user-visible history and the [stage index](docs/project/STAGE_INDEX.md) for engineering milestones.

## Development

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:extension
```

More commands and debugging notes are in the [development guide](docs/guides/DEVELOPMENT.md).

## License

Licensed under [MPL-2.0](LICENSE).
