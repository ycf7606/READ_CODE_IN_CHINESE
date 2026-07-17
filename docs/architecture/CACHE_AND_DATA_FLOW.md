# Cache and Data Flow

[English](CACHE_AND_DATA_FLOW.md) · [简体中文](CACHE_AND_DATA_FLOW.zh-CN.md) · [Architecture](../ARCHITECTURE.md)

All persistent extension data is scoped to the current workspace.

## Storage Layout

```text
.read-code-in-chinese/
  glossary/          editable file terminology
  knowledge/         imported and synced documents
  preprocess/        file-scoped symbol wordbooks
  token-knowledge/   repeated single-symbol fallback cache
  reports/           generated Markdown reports
  workspace-index.json
```

## Explanation Lookup Order

| Priority | Source | Compatibility key |
| ---: | --- | --- |
| 1 | File preprocess cache | File, symbol, context hash, builder/provider/audience fingerprint |
| 2 | Token knowledge cache | Language, origin, qualified API, and call-site identity when needed |
| 3 | Provider | Current selection and request context |

The glossary and retrieved knowledge are supporting context rather than final explanation caches.

## File Preprocess Cache

Each entry represents one selected file symbol and stores its generated meaning plus a symbol-context hash. The cache file also records:

- builder version;
- provider and fallback endpoints;
- model;
- occupation and professional level;
- user goal;
- algorithm fingerprint.

Unrelated edits may preserve entries whose context hash remains stable. A fingerprint mismatch invalidates the build even when symbol text is unchanged.

Partial writes contain only real completed entries. Legacy placeholder-like entries are removed on load.

## Token Knowledge Cache

The token cache remains a compatibility fallback after file-cache misses. Its current identity model prevents collisions such as two libraries exposing the same member name. Local call-site context is included when a plain qualified identity is insufficient.

Successful remote single-symbol explanations may populate this cache.

## Knowledge Library

Imported `.md`, `.txt`, and `.json` documents and synced reference pages share one workspace library. Documents are chunked and scored by keyword overlap, with title and tags weighted above raw body matches.

Top matches are attached to explanation and follow-up requests according to `readCodeInChinese.knowledge.topK`.

## Data Safety

- No cache is shared across workspaces.
- API keys are read from environment variables, not stored in cache files.
- Remote preprocessing applies trust, path, and size gates before request construction.
- Third-party Python packages are not imported to discover documentation.
- Unsaved document changes cancel in-flight preprocessing before stale results are persisted.
