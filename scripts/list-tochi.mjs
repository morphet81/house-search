#!/usr/bin/env node
/**
 * List HOME'S 土地 (tochi) matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:tochi
 *   node scripts/list-tochi.mjs [--prefs=…] [--out=…] [--headed] [--skip-detail]
 */

import { runHomesSearch } from "./lib/homes-search.mjs";

runHomesSearch("tochi", process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
