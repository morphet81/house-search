#!/usr/bin/env node
/**
 * Deduplicate existing result JSON files under output/.
 *
 *   npm run dedupe
 *   node scripts/dedupe-output.mjs [--dir=output] [--type=kodate] [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeListings } from "./lib/dedupe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { dir: path.join(root, "output"), type: null, dryRun: false };
  for (const a of argv) {
    if (a.startsWith("--dir=")) out.dir = path.resolve(root, a.slice(6));
    else if (a.startsWith("--type=")) out.type = a.slice(7);
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function processFile(filePath, dryRun) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const before = (raw.listings || []).length;
  const { listings, removed, clusters } = dedupeListings(raw.listings || []);
  const after = listings.length;

  console.log(`${path.basename(filePath)}: ${before} → ${after} (removed ${removed.length}, clusters ${clusters})`);
  if (removed.length) {
    for (const r of removed.slice(0, 20)) {
      console.log(`  drop ${r.id} → keep ${r.keptId} (score ${r.richness} < ${r.keptRichness})`);
    }
    if (removed.length > 20) console.log(`  … +${removed.length - 20} more`);
  }

  if (dryRun) return;

  const next = {
    ...raw,
    count: after,
    dedupedAt: new Date().toISOString(),
    dedupe: {
      before,
      after,
      removedCount: removed.length,
      clusters,
      removed,
    },
    listings,
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir)) {
    console.error(`No output dir: ${args.dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(args.dir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !args.type || f === `${args.type}.json`)
    .map((f) => path.join(args.dir, f));

  if (!files.length) {
    console.error("No matching JSON files.");
    process.exit(1);
  }

  for (const f of files) processFile(f, args.dryRun);
  if (args.dryRun) console.log("(dry-run: files not modified)");
}

main();
