#!/usr/bin/env node
/**
 * Build buy/rent filter-station GeoJSON maps from preferences.yaml.
 *
 * Usage:
 *   npm run stations:geojson
 *   node scripts/export-filter-stations.mjs [--prefs=config/preferences.yaml]
 *
 * Writes:
 *   output/filter-stations-buy.geojson
 *   output/filter-stations-rent.geojson
 *
 * Uses OpenStreetMap Nominatim (1 req/s). Reuses coordinates from any existing
 * filter-stations*.geojson in output/.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { expandLocation } from "./lib/homes-search.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "output");

const STATION_PREF_JA = new Map([
  ...[
    "元町・中華街",
    "石川町",
    "山手",
    "日本大通り",
    "馬車道",
    "みなとみらい",
    "新高島",
    "関内",
    "桜木町",
    "根岸",
    "磯子",
    "伊勢佐木長者町",
    "日ノ出町",
  ].map((n) => [n, "神奈川県"]),
  ...[
    "所沢",
    "航空公園",
    "新所沢",
    "入曽",
    "狭山市",
    "新狭山",
    "南大塚",
    "本川越",
    "西所沢",
    "小手指",
    "狭山ヶ丘",
    "武蔵藤沢",
    "稲荷山公園",
    "入間市",
    "仏子",
    "元加治",
    "飯能",
  ].map((n) => [n, "埼玉県"]),
  ...[
    "千葉",
    "西千葉",
    "稲毛",
    "新検見川",
    "幕張",
    "幕張本郷",
    "津田沼",
    "東船橋",
    "船橋",
    "西船橋",
    "下総中山",
    "本八幡",
    "市川",
  ].map((n) => [n, "千葉県"]),
]);

const PREF_VIEWBOX = {
  // Include western Tokyo (Seibu / Mitaka belt) — lon down to ~139.45
  東京都: { viewbox: "139.40,35.82,139.92,35.55", inBox: (lat, lon) => lat >= 35.55 && lat <= 35.82 && lon >= 139.4 && lon <= 139.92 },
  神奈川県: { viewbox: "139.45,35.55,139.75,35.25", inBox: (lat, lon) => lat >= 35.25 && lat <= 35.55 && lon >= 139.45 && lon <= 139.75 },
  埼玉県: { viewbox: "139.25,36.05,139.85,35.70", inBox: (lat, lon) => lat >= 35.7 && lat <= 36.05 && lon >= 139.25 && lon <= 139.85 },
  千葉県: { viewbox: "139.85,35.75,140.25,35.50", inBox: (lat, lon) => lat >= 35.5 && lat <= 35.75 && lon >= 139.85 && lon <= 140.25 },
};

function parseArgs(argv) {
  let prefs = path.join(root, "config/preferences.yaml");
  for (const a of argv) {
    if (a.startsWith("--prefs=")) prefs = path.resolve(root, a.slice(8));
  }
  return { prefs };
}

function stationsForDeal(doc, deal) {
  if (deal === "buy") {
    return expandLocation(doc, doc._buy_location || doc.kodate?.location || {}).stations;
  }
  const rentLoc =
    doc._rent_location ||
    doc.rent?.overrides?.mansion?.location ||
    doc.rent?.overrides?.kodate?.location ||
    {};
  return expandLocation(doc, rentLoc).stations;
}

function loadExistingCoords() {
  const map = new Map();
  const files = [
    "filter-stations-buy.geojson",
    "filter-stations-rent.geojson",
    "filter-stations.geojson", // legacy cache
  ];
  for (const file of files) {
    const p = path.join(outDir, file);
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const f of data.features || []) {
        const name = f.properties?.name;
        const coords = f.geometry?.coordinates;
        if (name && Array.isArray(coords) && coords.length >= 2 && !map.has(name)) {
          map.set(name, { lon: Number(coords[0]), lat: Number(coords[1]) });
        }
      }
    } catch {
      /* ignore bad cache */
    }
  }
  return map;
}

async function geocodeNominatim(name, prefecture = "東京都") {
  const q = `${prefecture} ${name}駅`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "jp");
  const box = PREF_VIEWBOX[prefecture] || PREF_VIEWBOX["東京都"];
  url.searchParams.set("viewbox", box.viewbox);
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

  for (const row of rows) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!box.inBox(lat, lon)) continue;
    return { lat, lon, display: row.display_name || null };
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveCoords(names, cached) {
  const coordsByName = new Map();
  const missing = [];
  for (const name of names) {
    let coords = cached.get(name) || null;
    if (coords) {
      console.error(`  cache  ${name}`);
    } else {
      try {
        const prefecture = STATION_PREF_JA.get(name) || "東京都";
        const hit = await geocodeNominatim(name, prefecture);
        await sleep(1100);
        if (hit) {
          coords = { lat: hit.lat, lon: hit.lon };
          console.error(`  geocode ${name} → ${hit.lat.toFixed(5)},${hit.lon.toFixed(5)}`);
          cached.set(name, coords);
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
    if (coords) coordsByName.set(name, coords);
  }
  return { coordsByName, missing };
}

function writeGeojson({ prefs, deal, names, coordsByName }) {
  const features = [];
  for (const name of names) {
    const coords = coordsByName.get(name);
    if (!coords) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coords.lon, coords.lat],
      },
      properties: { name, deal },
    });
  }
  const geojson = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    prefsFile: path.relative(root, prefs),
    deal,
    features,
  };
  const outPath = path.join(outDir, `filter-stations-${deal}.geojson`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2) + "\n");
  console.error(`Wrote ${features.length} features → ${path.relative(root, outPath)}`);
  return outPath;
}

async function main() {
  const { prefs } = parseArgs(process.argv.slice(2));
  const doc = loadYaml(fs.readFileSync(prefs, "utf8"));

  const buyNames = stationsForDeal(doc, "buy");
  const rentNames = stationsForDeal(doc, "rent");
  if (!buyNames.length && !rentNames.length) {
    console.error("No stations found in preferences.");
    process.exit(1);
  }

  const allNames = [...new Set([...buyNames, ...rentNames])].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
  console.error(
    `Stations: buy=${buyNames.length}, rent=${rentNames.length}, unique=${allNames.length}`
  );

  const cached = loadExistingCoords();
  const { coordsByName, missing } = await resolveCoords(allNames, cached);

  writeGeojson({ prefs, deal: "buy", names: buyNames, coordsByName });
  writeGeojson({ prefs, deal: "rent", names: rentNames, coordsByName });

  if (missing.length) {
    console.error(`Missing coordinates (${missing.length}): ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
