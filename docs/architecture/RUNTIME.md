# Runtime Flow

[English](RUNTIME.md) · [简体中文](RUNTIME.zh-CN.md) · [Architecture](../ARCHITECTURE.md)

## Selection Explanation

1. A command or debounced selection event asks the source-editor session for the current context.
2. The session starts a versioned explanation task and cancels the previous one.
3. Settings resolve from explicit VS Code values, then development environment defaults.
4. Workspace trust may force the local provider.
5. The glossary and compatible caches are loaded.
6. The selection inspector requests bounded hover and definition information.
7. Pure analysis determines granularity, symbol kind, origin, qualified name, and concise documentation.
8. Relevant workspace knowledge is retrieved from selection text, API identity, signature, and nearby context.
9. A single symbol checks the file preprocess cache, then the token knowledge cache.
10. On a cache miss, the local or remote provider builds a structured explanation.
11. Library documentation is appended once as concise evidence.
12. The task version and editor context are checked again before panel state is written.

This final validation prevents slow or failed older work from overwriting a newer selection.

## Panel Interaction

- Opening or clicking the webview does not replace the tracked source editor.
- Automatic updates do not repeatedly reveal the panel or steal source focus.
- Pause stops watched-selection requests without discarding the current explanation.
- Regenerate creates a new task for the current source selection.
- Follow-up chat has its own active task and is cancelled when the explanation context changes.
- UI controls remain disabled until their required state exists.

## File Preprocessing

1. The trigger mode and privacy policy are evaluated before provider creation.
2. Unsaved document changes invalidate current preprocessing work.
3. Candidates and bounded contexts are built.
4. Small pools use local ranking; larger pools may use provider selection.
5. Selected terms are processed in prioritized chunks.
6. Each successful chunk writes partial real entries.
7. Per-chunk remote failure can use local fallback.
8. The session verifies task currency before progress or final wordbook state is published.

See [Preprocessing and Caches](../guides/PREPROCESSING.md) for ranking and cache details.

## Provider Failure Behavior

- Primary and configured fallback endpoints are tried in order.
- Request timeout, HTTP failures, malformed responses, and unsupported options are logged.
- Compatible retries may reduce optional provider parameters.
- When no remote endpoint succeeds, explanation work can return a local fallback.
- Cancellation is not reported as a provider error.

## Runtime Guarantees

- At most one active task exists per workflow.
- Task versions only move forward.
- Replaced tasks are cancelled and disposed.
- Selection deduplication avoids identical automatic requests.
- Editor switches and document edits invalidate incompatible work.
- Webview state is updated only by the latest valid task.
