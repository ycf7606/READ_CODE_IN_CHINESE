# Importing Knowledge

The extension supports retrieval from local documents that you import into the current workspace.

## Supported Formats

- `.md`
- `.txt`
- `.json`

## JSON Format

You can import a JSON object or a JSON array. Each item should follow this shape:

```json
{
  "title": "document title",
  "content": "full text to retrieve from",
  "tags": ["optional", "keywords"]
}
```

## Typical Use Cases

- framework API notes
- standard library notes
- official syntax references that you prepared locally
- project-specific architecture docs

## Official Docs Sync

You can also populate the same knowledge library with the built-in official docs sync command:

- `Read Code In Chinese: Sync Official Docs For Active Language`

This command downloads a preset bundle for the active language, chunks the result, and stores it in the same workspace knowledge library.

## Retrieval Behavior

- retrieval is keyword-based
- top matches are attached to explanation requests
- the local heuristic provider and the remote provider can both use the imported snippets
- title and tag matches are weighted more heavily than raw content matches

## Storage

Imported knowledge is stored in the workspace cache directory:

```text
.read-code-in-chinese/knowledge/library.json
```
