const fs = require("fs");
const path = require("path");

const targets = ["dist", ".tmp-smoke-preprocess"];

for (const relativePath of targets) {
  const targetPath = path.join(process.cwd(), relativePath);

  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.warn(`[clean] skipped ${relativePath}: ${message}`);
  }
}
