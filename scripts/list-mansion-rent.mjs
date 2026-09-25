#!/usr/bin/env node
/**
 * List HOME'S 賃貸マンション matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:mansion-rent
 *   node scripts/list-mansion-rent.mjs [--prefs=…] [--out=…] [--headed] [--skip-detail]
 */

import { runHomesSearch } from "./lib/homes-search.mjs";

runHomesSearch("mansion_rent", process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
