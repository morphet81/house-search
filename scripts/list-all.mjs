#!/usr/bin/env node
/**
 * Run HOME'S searches for kodate, mansion, and tochi (sequential).
 *
 * Usage:
 *   npm run list:all
 *   node scripts/list-all.mjs [--headed] [--skip-detail] [--prefs=…]
 *
 * Extra flags pass through to each type runner. Outputs:
 *   output/kodate.json, output/mansion.json, output/tochi.json
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TYPES = ["kodate", "mansion", "tochi"];

function runOne(type, argv) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, `list-${type}.mjs`);
    console.error(`\n======== list:${type} ========`);
    const child = spawn(process.execPath, [script, ...argv], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`list:${type} exited ${code}`));
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  for (const type of TYPES) {
    await runOne(type, argv);
  }
  console.log("\nAll searches finished: kodate, mansion, tochi.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
