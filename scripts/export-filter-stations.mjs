#!/usr/bin/env node
/**
 * Build output/filter-stations.geojson from stations in preferences.yaml.
 *
 * Usage:
 *   npm run stations:geojson
 *   node scripts/export-filter-stations.mjs [--prefs=config/preferences.yaml]
 *
 * Uses OpenStreetMap Nominatim (1 req/s). Reuses existing coordinates when
 * a station name already appears in output/filter-stations.geojson.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "output", "filter-stations.geojson");

function parseArgs(argv) {
  let prefs = path.join(root, "config/preferences.yaml");
  for (const a of argv) {
    if (a.startsWith("--prefs=")) prefs = path.resolve(root, a.slice(8));
  }
  return { prefs };
}

function collectStationNames(doc) {
  const names = new Set();
  const add = (loc) => {
    for (const s of loc?.stations || []) {
      if (s) names.add(String(s).trim());
    }
  };
  add(doc._shared_location);
  for (const key of ["kodate", "mansion", "tochi"]) {
    add(doc[key]?.location);
  }
  // Also pick up stations only listed under defaults-style merges
  for (const [k, v] of Object.entries(doc)) {
    if (v && typeof v === "object" && v.location) add(v.location);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ja"));
}

function loadExistingCoords() {
  if (!fs.existsSync(outPath)) return new Map();
  try {
    const data = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const map = new Map();
    for (const f of data.features || []) {
      const name = f.properties?.name;
      const coords = f.geometry?.coordinates;
      if (name && Array.isArray(coords) && coords.length >= 2) {
        map.set(name, { lon: Number(coords[0]), lat: Number(coords[1]) });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function geocodeNominatim(name) {
  const q = `東京都 ${name}駅`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "jp");
  // Tokyo area viewbox: west,north,east,south
  url.searchParams.set("viewbox", "139.55,35.82,139.92,35.55");
  url.searchParams.set("bounded", "1");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "house-search/1.0 (local filter-stations map)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status} for ${name}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;

  const inTokyo = (lat, lon) =>
    lat >= 35.55 && lat <= 35.82 && lon >= 139.55 && lon <= 139.92;

  for (const row of rows) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!inTokyo(lat, lon)) continue;
    return { lat, lon, display: row.display_name || null };
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { prefs } = parseArgs(process.argv.slice(2));
  const doc = loadYaml(fs.readFileSync(prefs, "utf8"));
  const names = collectStationNames(doc);
  if (!names.length) {
    console.error("No stations found in preferences.");
    process.exit(1);
  }

  const cached = loadExistingCoords();
  const features = [];
  const missing = [];

  console.error(`Stations in prefs: ${names.length}`);
  for (const name of names) {
    let coords = cached.get(name) || null;
    if (coords) {
      console.error(`  cache  ${name}`);
    } else {
      try {
        const hit = await geocodeNominatim(name);
        await sleep(1100); // Nominatim usage policy
        if (hit) {
          coords = { lat: hit.lat, lon: hit.lon };
          console.error(`  geocode ${name} → ${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}`);
        } else {
          console.error(`  miss   ${name}`);
          missing.push(name);
        }
      } catch (err) {
        console.error(`  error  ${name}: ${err.message || err}`);
        missing.push(name);
        await sleep(1100);
      }
    }
    if (!coords) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coords.lon, coords.lat],
      },
      properties: { name },
    });
  }

  const geojson = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    prefsFile: path.relative(root, prefs),
    features,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2) + "\n");
  console.error(`\nWrote ${features.length} features → ${path.relative(root, outPath)}`);
  if (missing.length) {
    console.error(`Missing coordinates (${missing.length}): ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
