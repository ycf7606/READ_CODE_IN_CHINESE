import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "vscode", "suite", "index.js");
  const testWorkspace = path.resolve(
    __dirname,
    "../../src/test/fixtures/workspace"
  );
  const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH?.trim();

  await runTests({
    ...(vscodeExecutablePath
      ? { vscodeExecutablePath }
      : { version: "1.89.1" }),
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      testWorkspace,
      "--disable-extensions",
      "--skip-welcome",
      "--skip-release-notes"
    ],
    extensionTestsEnv: {
      ...process.env,
      READ_CODE_IN_CHINESE_PROVIDER_ID: "local"
    }
  });
}

main().catch((error) => {
  console.error("VS Code extension tests failed", error);
  process.exitCode = 1;
});
