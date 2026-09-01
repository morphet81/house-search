#!/usr/bin/env node
/**
 * List HOME'S 一戸建て (kodate) matching config/preferences.yaml.
 *
 * Usage:
 *   npm run list:kodate
 *   node scripts/list-kodate.mjs [--prefs=config/preferences.yaml] [--out=output/kodate.json]
 *
 * Location = union of ku search + station search (deduped by listing id).
 * Price max 13000万円: site only has 1.5億 step → query uses 15000, then client-filter.
 * constructible: drop listings that mention 再建築不可 (list + detail check).
 * Detail pass reads map-viewer lat/lon (same pin HOME'S shows) → googleMapsUrl.
 * Dedupe same physical house (near pins + same building area); keep richer listing.
 * Use --skip-detail to skip detail/maps (faster, list-only).
 * Standalone dedupe: npm run dedupe
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { chromium } from "playwright";
import { dedupeListings } from "./lib/dedupe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Tokyo 23-ku (+ common) JIS city codes used by HOME'S `cond[city][…]` */
const TOKYO_CITY = {
  千代田区: "13101",
  中央区: "13102",
  港区: "13103",
  新宿区: "13104",
  文京区: "13105",
  台東区: "13106",
  墨田区: "13107",
  江東区: "13108",
  品川区: "13109",
  目黒区: "13110",
  大田区: "13111",
  世田谷区: "13112",
  渋谷区: "13113",
  中野区: "13114",
  杉並区: "13115",
  豊島区: "13116",
  北区: "13117",
  荒川区: "13118",
  板橋区: "13119",
  練馬区: "13120",
  足立区: "13121",
  葛飾区: "13122",
  江戸川区: "13123",
};

/** Known stations → HOME'S `cond[roseneki][…]` (extend as needed) */
const STATION = {
  新板橋: "58706415",
  板橋区役所前: "58706416",
  西巣鴨: "58706414",
  板橋本町: "58706417",
  本蓮沼: "58706418",
};

const MADORI = {
  ワンルーム: "11",
  "1K": "12",
  "1DK": "13",
  "1LDK": "15",
  "2K": "22",
  "2DK": "23",
  "2LDK": "25",
  "3K": "32",
  "3DK": "33",
  "3LDK": "35",
  "4K": "42",
  "4DK": "43",
  "4LDK以上": "45-",
};

const MCF = {
  所有権: "120301",
  駐車場あり: "320801",
};

/** Ward (区) → English label */
const WARD_EN = {
  千代田区: "Chiyoda-ku",
  中央区: "Chuo-ku",
  港区: "Minato-ku",
  新宿区: "Shinjuku-ku",
  文京区: "Bunkyo-ku",
  台東区: "Taito-ku",
  墨田区: "Sumida-ku",
  江東区: "Koto-ku",
  品川区: "Shinagawa-ku",
  目黒区: "Meguro-ku",
  大田区: "Ota-ku",
  世田谷区: "Setagaya-ku",
  渋谷区: "Shibuya-ku",
  中野区: "Nakano-ku",
  杉並区: "Suginami-ku",
  豊島区: "Toshima-ku",
  北区: "Kita-ku",
  荒川区: "Arakawa-ku",
  板橋区: "Itabashi-ku",
  練馬区: "Nerima-ku",
  足立区: "Adachi-ku",
  葛飾区: "Katsushika-ku",
  江戸川区: "Edogawa-ku",
};

function wardFromAddress(address) {
  if (!address) return { ward: null, wardEn: null };
  const addr = String(address);
  // Prefer known 区 names (avoid matching 東京都北区 as one token)
  for (const [jp, en] of Object.entries(WARD_EN)) {
    if (addr.includes(jp)) return { ward: jp, wardEn: en };
  }
  const m = addr.match(/([^都道府県]+区)/);
  const ward = m ? m[1] : null;
  return { ward, wardEn: ward ? WARD_EN[ward] || null : null };
}

function parseStoreys(structureText) {
  if (!structureText) return null;
  const m = String(structureText).match(/(\d+)\s*階/);
  return m ? Number(m[1]) : null;
}

function parseBuildingAge(builtText, yearBuilt) {
  if (builtText) {
    const age = String(builtText).match(/築\s*(\d+)\s*年/);
    if (age) return Number(age[1]);
    const ym = String(builtText).match(/(\d{4})\s*年/);
    if (ym) {
      const y = Number(ym[1]);
      if (y > 1800) return Math.max(0, new Date().getFullYear() - y);
    }
  }
  if (yearBuilt != null && Number.isFinite(Number(yearBuilt))) {
    return Math.max(0, new Date().getFullYear() - Number(yearBuilt));
  }
  return null;
}

function parseArgs(argv) {
  const out = {
    prefs: path.join(root, "config/preferences.yaml"),
    out: path.join(root, "output/kodate.json"),
    headed: false,
    skipDetail: false,
  };
  for (const a of argv) {
    if (a.startsWith("--prefs=")) out.prefs = path.resolve(root, a.slice(8));
    else if (a.startsWith("--out=")) out.out = path.resolve(root, a.slice(6));
    else if (a === "--headed") out.headed = true;
    else if (a === "--skip-detail") out.skipDetail = true;
  }
  return out;
}

function loadKodatePrefs(file) {
  const doc = loadYaml(fs.readFileSync(file, "utf8"));
  const defaults = doc.defaults || {};
  const k = { ...defaults, ...(doc.kodate || {}) };
  // yaml anchors already resolved by js-yaml
  return k;
}

/** Nearest HOME'S moneyroom select value ≥ target (万円). */
function moneyroomCeil(manYen) {
  const steps = [
    0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000,
    6500, 7000, 8000, 9000, 10000, 15000, 20000, 25000, 30000,
  ];
  if (manYen == null) return null;
  for (const s of steps) {
    if (s >= manYen) return s;
  }
  return steps[steps.length - 1];
}

function buildCondParams(prefs, { cities = [], stations = [] } = {}) {
  const params = new URLSearchParams();

  for (const code of cities) {
    params.set(`cond[city][${code}]`, code);
  }
  for (const code of stations) {
    params.set(`cond[roseneki][${code}]`, code);
  }

  const priceMax = prefs.price?.max;
  if (priceMax != null) {
    params.set("cond[moneyroomh]", String(moneyroomCeil(priceMax)));
  }
  const priceMin = prefs.price?.min;
  if (priceMin != null && priceMin > 0) {
    params.set("cond[moneyroom]", String(priceMin));
  }

  const bMin = prefs.building_area_m2?.min;
  if (bMin != null) params.set("cond[housearea]", String(bMin));
  const bMax = prefs.building_area_m2?.max;
  if (bMax != null) params.set("cond[houseareah]", String(bMax));

  const lMin = prefs.land_area_m2?.min;
  if (lMin != null) params.set("cond[landarea]", String(lMin));
  const lMax = prefs.land_area_m2?.max;
  if (lMax != null) params.set("cond[landareah]", String(lMax));

  if (prefs.walk_minutes_max != null) {
    params.set("cond[walkminutesh]", String(prefs.walk_minutes_max));
  }
  if (prefs.include_bus_time) {
    params.set("cond[buswalk]", "1");
  }

  for (const label of prefs.madori || []) {
    const code = MADORI[label];
    if (!code) {
      console.warn(`unknown madori: ${label}`);
      continue;
    }
    params.set(`cond[madori][${code}]`, code);
  }

  const kodawari = [...(prefs.kodawari || [])];
  if (prefs.freehold && !kodawari.includes("所有権")) kodawari.push("所有権");
  if (prefs.parking && !kodawari.includes("駐車場あり")) kodawari.push("駐車場あり");
  for (const label of kodawari) {
    const code = MCF[label];
    if (!code) {
      console.warn(`unknown kodawari (skip query param): ${label}`);
      continue;
    }
    params.set(`cond[mcf][${code}]`, code);
  }

  return params;
}

function resolveCities(names) {
  const codes = [];
  for (const name of names || []) {
    const code = TOKYO_CITY[name];
    if (!code) throw new Error(`Unknown ku (add to TOKYO_CITY map): ${name}`);
    codes.push(code);
  }
  return codes;
}

function resolveStations(names) {
  const codes = [];
  for (const name of names || []) {
    const code = STATION[name];
    if (!code) throw new Error(`Unknown station (add to STATION map): ${name}`);
    codes.push(code);
  }
  return codes;
}

function listingBase(prefs) {
  const kind = prefs.listing === "shinchiku" ? "shinchiku" : "chuko";
  return `https://www.homes.co.jp/kodate/${kind}/tokyo/list/`;
}

function parseManYen(text) {
  if (!text) return null;
  const t = text.replace(/,/g, "").replace(/\s/g, "");
  const oku = t.match(/([\d.]+)\s*億/);
  const man = t.match(/([\d.]+)\s*万/);
  if (oku && man) return Math.round(parseFloat(oku[1]) * 10000 + parseFloat(man[1]));
  if (oku) return Math.round(parseFloat(oku[1]) * 10000);
  if (man) return Math.round(parseFloat(man[1]));
  return null;
}

function parseSqm(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, "").match(/([\d.]+)\s*m/i);
  return m ? parseFloat(m[1]) : null;
}

function extractId(url) {
  const m = url?.match(/\/kodate\/(b-\d+)\//);
  return m ? m[1] : null;
}

async function scrapeListPage(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".prg-building")];
    return cards
      .map((card) => {
        const link = card.querySelector('a[href*="/kodate/b-"]');
        const href = (link?.href || "").split("?")[0];
        const idMatch = href.match(/\/kodate\/(b-\d+)\//);

        const cellMap = {};
        card.querySelectorAll("tr").forEach((tr) => {
          const cells = [...tr.querySelectorAll("th,td")].map((c) =>
            (c.textContent || "").trim().replace(/\s+/g, " ")
          );
          for (let i = 0; i + 1 < cells.length; i += 2) {
            if (cells[i] && cells[i + 1] && cells[i].length < 20) {
              cellMap[cells[i]] = cells[i + 1];
            }
          }
        });
        // also scan flat td pairs when no tr structure
        if (!cellMap["価格"]) {
          const flat = [...card.querySelectorAll("td,th")].map((c) =>
            (c.textContent || "").trim().replace(/\s+/g, " ")
          );
          for (let i = 0; i + 1 < flat.length; i++) {
            if (["価格", "間取り", "土地面積", "建物面積"].includes(flat[i])) {
              cellMap[flat[i]] = flat[i + 1];
            }
          }
        }

        const imgs = [...card.querySelectorAll("img")].filter((img) => {
          const src = img.currentSrc || img.src || "";
          return src && /homes\.jp|image\.|img\./.test(src) && !/logo|icon|sprite/i.test(src);
        });
        const mainImg = imgs[0];
        const alt = imgs.map((img) => img.alt || "").find((a) => a && !/^掲載/.test(a));
        let title = (alt || "").replace(/の(リビング|外観|キッチン|浴室|トイレ).*$/, "").trim();
        if (!title) {
          title = (link?.getAttribute("title") || "").trim();
        }

        const raw = (card.innerText || "").replace(/\t/g, " ");
        const walkMatch = raw.match(/徒歩\s*(\d+)\s*分/);

        return {
          id: idMatch ? idMatch[1] : null,
          url: href,
          title: title.slice(0, 120),
          imageUrl: mainImg ? mainImg.currentSrc || mainImg.src : null,
          priceText: cellMap["価格"] || null,
          madori: (cellMap["間取り"] || "").split(/\s+/)[0] || null,
          landAreaText: cellMap["土地面積"] || null,
          buildingAreaText: cellMap["建物面積"] || null,
          walkMinutes: walkMatch ? Number(walkMatch[1]) : null,
          rawText: raw.replace(/<[^>]+>/g, " ").slice(0, 500),
        };
      })
      .filter((x) => x.id && x.url);
  });
}

async function totalCount(page) {
  return page.evaluate(() => {
    const t = document.body.innerText || "";
    const m = t.match(/([\d,]+)\s*件/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  });
}

async function scrapeAllPages(page, listUrl) {
  const results = [];
  let pageNo = 1;
  let guard = 0;
  while (guard++ < 100) {
    const url =
      pageNo === 1
        ? listUrl
        : `${listUrl}${listUrl.includes("?") ? "&" : "?"}page=${pageNo}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const count = await totalCount(page);
    const batch = await scrapeListPage(page);
    if (!batch.length) break;
    results.push(...batch);
    console.error(`  page ${pageNo}: +${batch.length} (site says ${count ?? "?"} total)`);
    if (count != null && results.length >= count) break;
    // detect last page: no next link
    const hasNext = await page.locator(`a[href*="page=${pageNo + 1}"]`).count();
    if (!hasNext) break;
    pageNo += 1;
  }
  return results;
}

async function enrichDetail(context, item) {
  const page = await context.newPage();
  try {
    await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    const detail = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const pick = (label) => {
        const re = new RegExp(label + "\\s*([^\\n]+)");
        const m = text.match(re);
        return m ? m[1].trim().slice(0, 120) : null;
      };

      // HOME'S property pin (not realtor office)
      const mapEl = document.querySelector("map-viewer-google-map[data-lat][data-lon]");
      let lat = mapEl ? Number(mapEl.getAttribute("data-lat")) : null;
      let lon = mapEl ? Number(mapEl.getAttribute("data-lon")) : null;

      let address = null;
      let postalCode = null;
      let yearBuilt = null;
      let builtText = null;
      let structure = null;
      let imageUrl = null;
      try {
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
          const data = JSON.parse(s.textContent || "null");
          const house = data?.mainEntity;
          if (!house) continue;
          if (house.geo?.latitude != null && house.geo?.longitude != null) {
            lat = Number(house.geo.latitude);
            lon = Number(house.geo.longitude);
          }
          if (house.yearBuilt != null) yearBuilt = Number(house.yearBuilt);
          const a = house.address;
          if (a) {
            postalCode = a.postalCode || null;
            const parts = [a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean);
            if (parts.length) address = parts.join("");
          }
          const props = house.additionalProperty || [];
          const byName = (n) => props.find((p) => p?.name === n)?.value;
          const locProp = byName("所在地");
          if (locProp) {
            const v = String(locProp).trim();
            if (!address || v.length >= address.length) address = v;
          }
          builtText = byName("築年月") || builtText;
          structure = byName("建物構造") || structure;

          const images = Array.isArray(house.image) ? house.image : house.image ? [house.image] : [];
          const urls = images
            .map((img) => (typeof img === "string" ? { contentUrl: img } : img))
            .filter((img) => img?.contentUrl);
          const exterior = urls.find((img) => /外観/.test(img.caption || ""));
          imageUrl = (exterior || urls[0])?.contentUrl || imageUrl;
        }
      } catch {
        /* ignore bad JSON-LD */
      }

      if (!address) address = pick("所在地") || pick("住所");
      if (!builtText) builtText = pick("築年月") || pick("築年数");
      if (!structure) structure = pick("建物構造");
      if (!imageUrl) {
        const og = document.querySelector('meta[property="og:image"]')?.content;
        if (og) imageUrl = og;
      }

      return {
        landRight: pick("土地の権利") || pick("土地権利"),
        leaseType: pick("借地権の種類・期間"),
        zoning: pick("用途地域"),
        cityPlan: pick("都市計画"),
        landUse: pick("地目"),
        rebuildForbidden: /再建築不可/.test(text),
        freeholdMention:
          /土地の権利\s*所有権/.test(text) ||
          /土地権利\s*所有権/.test(text) ||
          /所有権/.test(pick("土地の権利") || pick("土地権利") || ""),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        address: address || null,
        postalCode,
        yearBuilt: Number.isFinite(yearBuilt) ? yearBuilt : null,
        builtText: builtText || null,
        structure: structure || null,
        imageUrl: imageUrl || null,
      };
    });

    const location = buildGoogleMapsLocation(detail);
    const { ward, wardEn } = wardFromAddress(detail.address || location.address);
    const buildingAgeYears = parseBuildingAge(detail.builtText, detail.yearBuilt);
    const storeys = parseStoreys(detail.structure);
    return {
      ...item,
      detail,
      ...location,
      ward,
      wardEn,
      yearBuilt: detail.yearBuilt,
      buildingAgeYears,
      storeys,
      structure: detail.structure,
      imageUrl: detail.imageUrl || item.imageUrl || null,
    };
  } catch (e) {
    return { ...item, detailError: String(e.message || e) };
  } finally {
    await page.close();
  }
}

/** Prefer exact HOME'S map pin; fall back to address query at best published precision. */
function buildGoogleMapsLocation(detail) {
  const address = detail?.address || null;
  const lat = detail?.lat ?? null;
  const lon = detail?.lon ?? null;

  if (lat != null && lon != null) {
    const q = `${lat},${lon}`;
    return {
      lat,
      lon,
      address,
      locationAccuracy: "coordinates", // same pin as HOME'S map-viewer
      googleMapsUrl: `https://www.google.com/maps?q=${encodeURIComponent(q)}`,
    };
  }

  if (address) {
    let locationAccuracy = "area";
    if (/[0-9０-９]+([-ー−ノ之][0-9０-９]+)?(番|号)/.test(address) || /\d+-\d+/.test(address)) {
      locationAccuracy = "banchi";
    } else if (/丁目/.test(address)) {
      locationAccuracy = "chome";
    }
    return {
      lat: null,
      lon: null,
      address,
      locationAccuracy,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    };
  }

  return {
    lat: null,
    lon: null,
    address: null,
    locationAccuracy: null,
    googleMapsUrl: null,
  };
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

function clientFilter(items, prefs) {
  return items.filter((it) => {
    const price = parseManYen(it.priceText);
    it.priceManYen = price;
    if (prefs.price?.max != null && price != null && price > prefs.price.max) return false;

    const bArea = parseSqm(it.buildingAreaText);
    it.buildingAreaM2 = bArea;
    if (prefs.building_area_m2?.min != null && bArea != null && bArea < prefs.building_area_m2.min) {
      return false;
    }

    if (prefs.walk_minutes_max != null && it.walkMinutes != null && it.walkMinutes > prefs.walk_minutes_max) {
      return false;
    }

    if (
      prefs.constructible &&
      (/再建築不可|再建不/.test(it.rawText || "") ||
        /再建築不可|再建不/.test(it.title || "") ||
        it.detail?.rebuildForbidden)
    ) {
      return false;
    }

    if (prefs.freehold && it.detail && it.detail.landRight && !/所有権/.test(it.detail.landRight)) {
      return false;
    }

    return true;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prefs = loadKodatePrefs(args.prefs);
  const cities = resolveCities(prefs.location?.ku || []);
  const stations = resolveStations(prefs.location?.stations || []);
  const base = listingBase(prefs);

  console.error("prefs:", args.prefs);
  console.error("listing:", prefs.listing, "ku:", prefs.location?.ku?.join(", "));
  console.error("stations:", prefs.location?.stations?.join(", "));

  const browser = await chromium.launch({
    headless: !args.headed,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "ja-JP",
    extraHTTPHeaders: { "Accept-Language": "ja-JP,ja;q=0.9" },
  });
  const page = await context.newPage();

  const byId = new Map();

  try {
    if (cities.length) {
      const q = buildCondParams(prefs, { cities });
      const url = `${base}?${q.toString()}`;
      console.error("\n[ku search]", url.slice(0, 120) + "…");
      const rows = await scrapeAllPages(page, url);
      for (const r of rows) {
        byId.set(r.id, { ...r, matchedVia: ["ku"] });
      }
    }

    if (stations.length) {
      const q = buildCondParams(prefs, { stations });
      const url = `${base}?${q.toString()}`;
      console.error("\n[station search]", url.slice(0, 120) + "…");
      const rows = await scrapeAllPages(page, url);
      for (const r of rows) {
        const prev = byId.get(r.id);
        if (prev) {
          prev.matchedVia = [...new Set([...(prev.matchedVia || []), "station"])];
        } else {
          byId.set(r.id, { ...r, matchedVia: ["station"] });
        }
      }
    }

    let items = [...byId.values()];
    console.error(`\nunique before client filter: ${items.length}`);

    // cheap list-text filter first
    items = clientFilter(items, prefs);
    console.error(`after list client filter: ${items.length}`);

    // Detail pass: maps pin + freehold/constructible verification
    if (!args.skipDetail && items.length) {
      console.error(`detail enrich (maps / freehold / constructible)…`);
      items = await mapPool(items, 3, (it) => enrichDetail(context, it));
      items = clientFilter(items, prefs);
      console.error(`after detail filter: ${items.length}`);
    } else if (args.skipDetail) {
      console.error("skip-detail: no googleMapsUrl / detail checks");
    }

    const beforeDedupe = items.length;
    const deduped = dedupeListings(items);
    items = deduped.listings;
    console.error(
      `after dedupe: ${items.length} (removed ${deduped.removed.length} across ${deduped.clusters} clusters)`
    );

    items.sort((a, b) => (a.priceManYen ?? 1e12) - (b.priceManYen ?? 1e12));

    const payload = {
      scrapedAt: new Date().toISOString(),
      source: "homes.co.jp",
      prefsFile: path.relative(root, args.prefs),
      filters: {
        listing: prefs.listing,
        ku: prefs.location?.ku || [],
        stations: prefs.location?.stations || [],
        priceMaxManYen: prefs.price?.max ?? null,
        buildingAreaMinM2: prefs.building_area_m2?.min ?? null,
        madori: prefs.madori || [],
        walkMinutesMax: prefs.walk_minutes_max ?? null,
        freehold: !!prefs.freehold,
        constructible: !!prefs.constructible,
        parking: !!prefs.parking,
      },
      count: items.length,
      dedupe: {
        before: beforeDedupe,
        after: items.length,
        removedCount: deduped.removed.length,
        clusters: deduped.clusters,
        removed: deduped.removed,
      },
      listings: items.map(({ rawText, ...rest }) => rest),
    };

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(payload, null, 2));

    const withMaps = items.filter((it) => it.googleMapsUrl).length;
    const viaKu = items.filter((it) => it.matchedVia?.includes("ku")).length;
    const viaStation = items.filter((it) => it.matchedVia?.includes("station")).length;
    const prices = items.map((it) => it.priceManYen).filter((n) => n != null);
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;

    console.log(`Found ${items.length} kodate listing(s).`);
    if (deduped.removed.length) {
      console.log(`Deduped: removed ${deduped.removed.length} duplicate posting(s).`);
    }
    if (prices.length) {
      console.log(`Price range: ${priceMin.toLocaleString()}–${priceMax.toLocaleString()} 万円`);
    }
    console.log(`Matched via: ku=${viaKu}, station=${viaStation}`);
    if (!args.skipDetail) {
      console.log(`Google Maps URLs: ${withMaps}/${items.length}`);
    }
    console.log(`Results: ${args.out}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
