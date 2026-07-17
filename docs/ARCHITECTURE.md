# Architecture

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Documentation](README.md)

The extension combines local analysis, VS Code language services, workspace-scoped caches, optional knowledge retrieval, and local or remote explanation providers.

## Architecture Map

| Document | Focus |
| --- | --- |
| [Overview](architecture/OVERVIEW.md) | Module boundaries and responsibilities |
| [Runtime Flow](architecture/RUNTIME.md) | Selection lifecycle, cancellation, and provider execution |
| [Cache and Data Flow](architecture/CACHE_AND_DATA_FLOW.md) | Storage layout, lookup order, and invalidation |
| [Testing](architecture/TESTING.md) | Unit, Extension Host, and manual interaction coverage |

## Core Design Priorities

- Explain the current code context, not a generic token definition.
- Treat variables, functions, types, modules, and library APIs differently.
- Prefer fast local results and compatible caches before remote calls.
- Cancel stale work before it can overwrite newer editor state.
- Keep remote preprocessing explicit, bounded, and workspace-trust aware.
- Reuse language-service documentation without importing or executing packages.
- Preserve concise, structured Chinese output.
- Keep the webview low-noise, focus-safe, and safe from direct HTML injection.
- Verify both pure logic and real VS Code integration.

## Top-Level Modules

| Area | Responsibility |
| --- | --- |
| `src/extension.ts` | Activation, command wiring, orchestration, and service coordination |
| `src/runtime/` | Source-editor tracking, task versions, cancellation, and reading priority |
| `src/analysis/` | Selection semantics, glossary extraction, context construction, and summaries |
| `src/vscode/` | Bounded hover/definition inspection |
| `src/providers/` | Local and OpenAI-compatible provider adapters |
| `src/knowledge/` | Retrieval, official docs, preprocessing, and token caches |
| `src/storage/` | Workspace paths and JSON persistence |
| `src/ui/` | Glossary tree, explanation panel, and settings panel |
| `src/logging/` | VS Code output-channel diagnostics |
