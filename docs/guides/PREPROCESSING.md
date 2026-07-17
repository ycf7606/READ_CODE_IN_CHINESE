# Preprocessing and Caches

[English](PREPROCESSING.md) · [简体中文](PREPROCESSING.zh-CN.md) · [Documentation](../README.md)

File preprocessing builds a short, reusable wordbook for user-defined variables, functions, classes, types, and label-like terms. It is optimized for relevant context rather than sending the whole file blindly.

## Trigger and Privacy Policy

| Setting | Default | Meaning |
| --- | ---: | --- |
| `readCodeInChinese.preprocess.mode` | `manual` | `off`, `manual`, `onSave`, or `idle` |
| `readCodeInChinese.preprocess.exclude` | sensitive/build globs | Files that may not be sent for remote preprocessing |
| `readCodeInChinese.preprocess.maxFileBytes` | `262144` | Maximum UTF-8 source size |
| `readCodeInChinese.preprocess.maxCandidates` | `120` | Maximum symbols considered per run |

Remote preprocessing is rejected when the workspace is untrusted, the file is oversized, or its path matches an exclusion rule. Background remote work only occurs after the user explicitly selects `onSave` or `idle`; the default is manual.

Default exclusions cover environment files, keys, certificates, common secret files, dependencies, build output, Git data, minified JavaScript, and source maps.

## Processing Pipeline

1. Extract a raw candidate pool from syntax, assignments, calls, document symbols, and label-like strings.
2. Build bounded definition/reference windows and retain relevant long function scopes.
3. If fewer than 24 candidates exist, rank locally and skip an extra model request.
4. For larger pools, let the configured provider select useful terms from compact context.
5. Retain candidates according to the audience profile: all for beginners, about 85% for intermediate users, and about 70% for experts.
6. Process selected symbols in prioritized chunks of about 20 terms.
7. Write real partial results after each completed chunk.
8. Reprioritize remaining chunks around recently read selections.

Variables are summarized by meaning, source, transformations, and consumers. Functions are summarized by responsibility, inputs, outputs, and important side effects.

## Context Accuracy

- Each symbol receives a bounded definition and reference view instead of the full file.
- The total context budget is divided across candidates, preventing early symbols from starving later ones.
- Long Python indentation scopes and brace-delimited scopes are retained up to a fixed bound.
- A per-symbol context hash allows unrelated edits to preserve unaffected entries.
- Unsaved edits immediately cancel in-flight preprocessing; a later idle run may rebuild after editing settles.
- Remote batch failures fall back per chunk so one failed request does not discard the whole job.

## Cache Lookup and Invalidation

Single-symbol explanations use this order:

1. Compatible file preprocess cache.
2. Identity-safe token knowledge cache.
3. Remote or local provider.

Workspace storage:

```text
.read-code-in-chinese/
  preprocess/
  token-knowledge/
  glossary/
  knowledge/
  reports/
  workspace-index.json
```

A file cache is invalidated when its builder version or provider/audience fingerprint changes. The fingerprint includes provider endpoints, model, occupation, professional level, user goal, and algorithm version. Same-name token entries are separated by origin, qualified API name, and local call-site context where required.

Legacy placeholder entries are discarded when caches are loaded.

## Progress in the Panel

The panel separates candidate-pool size, selected-target count, reusable cached entries, and processed batches. Batch counters appear only during actual batch processing, and the final wordbook displays the full current-file cache grouped by scope.
