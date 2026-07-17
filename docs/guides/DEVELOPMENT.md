# Development and Testing

[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-CN.md) · [Documentation](../README.md)

## Requirements

- Node.js and npm
- VS Code 1.89 or newer
- PowerShell examples below use `npm.cmd` for reliable Windows execution

## Install and Build

```powershell
npm.cmd install
npm.cmd run compile
```

Use `npm.cmd run watch` while editing TypeScript.

## Run in VS Code

1. Open the repository in VS Code.
2. Install dependencies and compile.
3. Press `F5` to start the Extension Development Host.
4. Complete the first-run settings panel.
5. Open a source file and run **Read Code In Chinese: Open Conversation Panel**.
6. Select variables, functions, and library calls to verify their different explanation dimensions.
7. Run **Read Code In Chinese: Show Logs** if the effective provider is unexpected.

For local remote-provider testing, put environment defaults in an ignored `.vscode/.env` file or set them in the shell that launches VS Code. Never commit API keys.

## Verification Commands

| Command | Coverage |
| --- | --- |
| `npm.cmd run check` | TypeScript type checking without output |
| `npm.cmd test` | Compile and run the unit suite |
| `npm.cmd run test:extension` | Real VS Code Extension Host smoke test |
| `npm.cmd run test:all` | Unit and Extension Host tests |
| `npm.cmd run vscode:prepublish` | Prepublish compilation |

To use an existing VS Code installation for the Extension Host test:

```powershell
$env:VSCODE_EXECUTABLE_PATH="E:\Microsoft VS Code\Code.exe"
npm.cmd run test:extension
```

Without `VSCODE_EXECUTABLE_PATH`, the test runner downloads VS Code 1.89.1 into `.vscode-test/`.

Optional VSIX packaging:

```powershell
npx.cmd @vscode/vsce package
```

## Test Layers

- Pure unit tests cover analysis, prompts, caches, providers, and runtime session lifecycle.
- The Extension Host smoke test covers activation, command registration, editor interaction, and preprocessing safety in VS Code.
- Manual UX checks should confirm focus retention, pause/resume, stale-task cancellation, loading state, wordbook progress, and follow-up controls.

See [Testing Architecture](../architecture/TESTING.md) for the verification strategy.

## Project Rules

- Keep source-code comments in English.
- Prefer small modules over expanding `src/extension.ts`.
- Keep Chinese explanations concise and structured.
- Preserve workspace-scoped caches and privacy gates.
- Update relevant English and Chinese documentation together.
- Add user-visible changes to [CHANGELOG.md](../../CHANGELOG.md).
