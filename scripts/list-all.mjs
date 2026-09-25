#!/usr/bin/env node
/**
 * Run HOME'S searches for buy + rent types (sequential).
 *
 * Usage:
 *   npm run list:all
 *   node scripts/list-all.mjs [--headed] [--skip-detail] [--prefs=…]
 *
 * Extra flags pass through to each type runner. Outputs:
 *   output/kodate.json, output/mansion.json, output/tochi.json,
 *   output/kodate_rent.json, output/mansion_rent.json
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JOBS = [
  { key: "kodate", script: "list-kodate.mjs" },
  { key: "mansion", script: "list-mansion.mjs" },
  { key: "tochi", script: "list-tochi.mjs" },
  { key: "kodate_rent", script: "list-kodate-rent.mjs" },
  { key: "mansion_rent", script: "list-mansion-rent.mjs" },
];

function runOne(job, argv) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, job.script);
    console.error(`\n======== list:${job.key} ========`);
    const child = spawn(process.execPath, [script, ...argv], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`list:${job.key} exited ${code}`));
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  for (const job of JOBS) {
    await runOne(job, argv);
  }
  console.log("\nAll searches finished: buy (kodate, mansion, tochi) + rent (kodate, mansion).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
