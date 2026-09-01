#!/usr/bin/env node
/**
 * List HOME'S 一戸建て (kodate) matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:kodate
 *   node scripts/list-kodate.mjs [--prefs=…] [--out=…] [--headed] [--skip-detail]
 */

import { runHomesSearch } from "./lib/homes-search.mjs";

runHomesSearch("kodate", process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
