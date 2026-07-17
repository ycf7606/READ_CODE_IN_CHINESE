# Testing Architecture

[English](TESTING.md) · [简体中文](TESTING.zh-CN.md) · [Architecture](../ARCHITECTURE.md)

The project uses layered verification because pure analysis tests cannot prove that editor focus, command registration, or Webview integration behaves correctly inside VS Code.

## Automated Layers

| Layer | Command | Covers |
| --- | --- | --- |
| Type check | `npm.cmd run check` | TypeScript contracts and compile-time integration |
| Unit suite | `npm.cmd test` | Analysis, prompts, providers, caches, and runtime lifecycle |
| Extension Host | `npm.cmd run test:extension` | Activation and real VS Code editor/command behavior |
| Combined | `npm.cmd run test:all` | Unit and Extension Host suites |

The current baseline contains 41 unit tests plus the Extension Host smoke test.

## High-Risk Regression Areas

- A stale explanation or failure must not replace a newer selection.
- Clicking the panel must not lose the tracked source editor.
- Pause/resume and regenerate must use the current source selection.
- Variables and functions must build different explanation dimensions.
- Qualified Python imports and aliases must resolve without executing packages.
- Same-name APIs must not share incompatible cache entries.
- Unsaved edits must cancel preprocessing and block stale writes.
- Preprocessing must obey trust, exclusions, size limits, and trigger mode.
- Webview content must be rendered safely and controls must reflect loading state.
- Primary and fallback endpoints must fail over predictably.

## Manual Interaction Checklist

1. Start the Extension Development Host with `F5`.
2. Open the conversation panel beside a source file.
3. Select a variable, function, class, and library API.
4. Confirm the source editor keeps focus during automatic updates.
5. Change selection quickly while a request is running; only the newest result should appear.
6. Pause following, change selection, resume, and regenerate.
7. Run file preprocessing and verify phase labels and counts.
8. Edit the file during preprocessing and confirm stale work stops.
9. Ask a follow-up only after an explanation is ready.
10. Review **Read Code In Chinese** logs for provider and fallback details.

## Packaging Check

A release candidate should compile and produce a VSIX:

```powershell
npm.cmd run vscode:prepublish
npx.cmd @vscode/vsce package
```

Package output should be inspected to ensure secrets, local caches, test downloads, and development-only files are excluded.
