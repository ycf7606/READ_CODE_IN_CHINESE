# READ_CODE_IN_CHINESE

Repository for a VS Code extension that aims to translate source code into concise natural-language explanations for faster code reading.

## Project Status

- Stage 1 completed on 2026-04-13
- Current tracking board: `docs/project/WORKBOARD.md`
- Latest milestone summary: `docs/project/summaries/2026-04-13-stage-1.md`

## Current Focus

The current milestone is Stage 2: build the minimal explanation loop with provider abstraction and better user feedback.

## Current Capabilities

- Register the `Explain Selection` command
- Register the `Toggle Auto Explain` command
- Read workspace configuration for provider and explanation defaults
- Show a placeholder explanation message for the selected code

## Local Development

Install dependencies:

```powershell
npm.cmd install
```

Compile the extension:

```powershell
npm.cmd run compile
```

Run the extension in VS Code:

1. Open this repository in VS Code.
2. Run `npm.cmd install`.
3. Run `npm.cmd run compile`.
4. Press `F5` to start the Extension Development Host.
5. Use `Ctrl+Alt+E` to run `Read Code In Chinese: Explain Selection`.
6. Use `Ctrl+Alt+T` to run `Read Code In Chinese: Toggle Auto Explain`.

## Configuration

- `readCodeInChinese.autoExplain.enabled`
- `readCodeInChinese.provider.id`
- `readCodeInChinese.provider.baseUrl`
- `readCodeInChinese.provider.model`
- `readCodeInChinese.provider.apiKeyEnvVar`
- `readCodeInChinese.explanation.detailLevel`
- `readCodeInChinese.explanation.professionalLevel`
- `readCodeInChinese.explanation.sections`

## Notes

- The current implementation is a scaffold milestone. It does not call any model provider yet.
- Source code comments are written in English by project rule.
