#!/usr/bin/env node
/**
 * List HOME'S 賃貸一戸建て matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:kodate-rent
 *   node scripts/list-kodate-rent.mjs [--prefs=…] [--out=…] [--headed] [--skip-detail]
 */

import { runHomesSearch } from "./lib/homes-search.mjs";

runHomesSearch("kodate_rent", process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
