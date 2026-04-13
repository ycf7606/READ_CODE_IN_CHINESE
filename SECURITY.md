# Security Policy

## Reporting

If you find a security issue, report it privately to the repository owner before opening a public issue.

## Scope

Important areas include:

- remote provider API handling
- environment variable usage
- imported knowledge file parsing
- workspace file scanning and cache writes

## Current Security Notes

- API keys are read from environment variables, not hardcoded in files
- Imported knowledge is stored inside the workspace cache directory
- The extension only scans the active workspace when building a workspace index
