# Stage 0 Baseline

## Purpose

Stage 0 converts the initial product idea into an executable engineering baseline. The repository currently contains almost no application code, so the correct first milestone is to lock scope, architecture direction, and progress-tracking rules before scaffolding the extension.

## Repository Baseline

- Current repository contents are minimal: `.git`, `LICENSE`, `README.md`.
- Remote origin points to `https://github.com/ycf7606/READ_CODE_IN_CHINESE.git`.
- Current branch is `main`.
- Current license file is MPL-2.0.
- Current README is only a title placeholder.

## Product Baseline

- Product type: VS Code extension.
- Primary user action: select code and request or receive a natural-language explanation.
- Default language: Chinese explanation output.
- Product objective: faster code reading with less prompt-writing overhead.

## Implementation Direction

### Architecture

- Extension entry layer
  - command registration
  - configuration loading
  - activation lifecycle
- Context collection layer
  - selected text
  - file path
  - language id
  - nearby code context
- Prompt builder layer
  - converts user settings and context into a stable prompt shape
- Model adapter layer
  - isolates provider-specific request logic
- Cache and glossary layer
  - stores file-level glossary and future explanation cache
- UI layer
  - starts with native VS Code notifications, hover-like surfaces, or webview only when necessary

### Priority Order

1. Build the extension scaffold.
2. Make command execution visible inside VS Code.
3. Add a minimal selection-to-explanation loop.
4. Add file-level glossary generation and reuse.
5. Expand into multiple explanation granularities.

## Locked Decisions

- Stage 1 will use TypeScript for the extension code.
- Stage 1 will implement only the minimal extension skeleton, not model integration.
- The first stable explanation scope is selected text plus short local context.
- The first stable cache scope is file-level glossary data.
- Explanation output should prefer compact, structured sections over long prose.
- Source code comments should use English.
- Retrieval from official docs is deferred until Stage 6.
- Fine-tuning is explicitly out of scope until retrieval quality is evaluated.

## Risks and Constraints

- Git is not available on the default shell `PATH`; repository operations must use the discovered `git.exe` path unless the environment changes.
- The user's desired future license policy conflicts with standard OSI open-source definitions. Keep the current license untouched until the user explicitly requests a license change.
- Repository identity and push authentication may depend on the local Git credential state. This must be verified at push time.

## Stage 1 Entry Criteria

Stage 1 starts when the repository contains:

- a VS Code extension `package.json`
- a minimal source entry file
- command registration
- extension configuration schema
- a documented local development command path

## Stage 0 Exit Criteria

Stage 0 is complete when:

- tracking files exist
- the baseline document exists
- the latest summary exists
- the next-stage todo list is explicit

All Stage 0 exit criteria are now met.
