# Features and Interaction

[English](FEATURES.md) · [简体中文](FEATURES.zh-CN.md) · [Documentation](../README.md)

## Selection-Aware Explanations

The extension classifies a single-symbol selection before building the request.

| Selection | Explanation focus |
| --- | --- |
| Variable or constant | Meaning, value source, transformations, consumers, and state changes |
| Function or method | Responsibility, inputs, outputs, side effects, and important call paths |
| Class or type | Role, state, construction, and public behavior |
| Module or package | Purpose, imported surface, and current-file relevance |
| Library or built-in API | Qualified name, signature, concise documentation evidence, and call-site usage |
| Statement or block | Control flow, data flow, and local effect |
| File | File responsibility and major symbols |
| Workspace | File index and project-level structure |

Python aliases, dotted imports, multiline `from ... import (...)` statements, and qualified calls are resolved where possible. Hover and definition providers help distinguish workspace code from installed libraries. Third-party packages are never imported or executed for documentation discovery.

## Explanation Panel

The panel is designed to stay open beside the source editor.

- Follows source selections without repeatedly stealing editor focus.
- Shows the active file, selection, detected kind, origin, and qualified API name.
- Cancels obsolete explanation and follow-up tasks when context changes.
- Provides pause/resume, regenerate, settings, and reasoning-effort controls.
- Disables follow-up actions until a current explanation exists.
- Renders model content through safe text-based DOM construction.

## File Wordbook and Glossary

Two related views serve different needs:

- **Code Glossary** in Explorer stores editable, file-level terminology.
- **Wordbook** in the panel displays preprocessed symbol explanations for the active file.

The wordbook shows the complete current-file cache and groups entries into module, class, and function scopes. Member calls such as `self.load(...)`, `cls.build(...)`, and `this.render(...)` can be recognized as file-local functions.

For preprocessing details, see [Preprocessing and Caches](PREPROCESSING.md).

## Knowledge Tools

- Import local `.md`, `.txt`, and `.json` documents.
- Retrieve the most relevant workspace-scoped snippets for explanations and follow-ups.
- Sync preset official/reference documentation for TypeScript, JavaScript, Python, Go, Rust, and Java.
- Continue after partial documentation-sync failures.
- Generate a Markdown workspace index under `.read-code-in-chinese/reports/`.

See [Importing Knowledge](../knowledge/IMPORTING_KNOWLEDGE.md) for the document format.

## Provider Experience

- **Local**: no API key, offline-friendly, deterministic heuristics.
- **OpenAI-compatible**: remote structured explanations, candidate selection, prompt generation, and fallback endpoints.
- Untrusted workspaces can be forced onto the local provider.
- Runtime diagnostics are available in the **Read Code In Chinese** output channel.

Provider setup is documented in [Configuration](CONFIGURATION.md).
