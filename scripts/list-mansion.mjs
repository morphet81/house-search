#!/usr/bin/env node
/**
 * List HOME'S マンション (mansion) matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:mansion
 *   node scripts/list-mansion.mjs [--prefs=…] [--out=…] [--headed] [--skip-detail]
 */

import { runHomesSearch } from "./lib/homes-search.mjs";

runHomesSearch("mansion", process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
