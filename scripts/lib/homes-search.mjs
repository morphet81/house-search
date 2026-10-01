/**
 * Shared LIFULL HOME'S list scraper for buy (kodate / mansion / tochi)
 * and rent (kodate_rent / mansion_rent).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { chromium } from "playwright";
import { dedupeListings } from "./dedupe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "../..");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

const STATION = {
  // Campus / Mita north + Toden + Saikyo (LFI ±4)
  新板橋: "58706415",
  板橋: "9500631",
  西巣鴨: "58706414",
  巣鴨: "58700585",
  板橋区役所前: "58706416",
  板橋本町: "58706417",
  本蓮沼: "58706418",
  志村坂上: "58706419",
  千石: "58706413",
  白山: "58706412",
  滝野川一丁目: "takinogawaitchome_06460",
  西ヶ原四丁目: "nishigaharayonchome_06461",
  新庚申塚: "shinkoshinzuka_06462",
  庚申塚: "koshinzuka_06463",
  巣鴨新田: "sugamoshinden_06464",
  飛鳥山: "asukayama_06459",
  大塚: "9100584",
  王子: "58500601",
  西ケ原: "58506394",
  駒込: "58500586",
  池袋: "57700488",
  北池袋: "kitaikebukuro_04746",
  十条: "9500632",
  赤羽: "9500533",
  北赤羽: "9500633",
  // Line 1 belt (Iidabashi)
  飯田橋: "58900751",
  市ケ谷: "58500752",
  四ツ谷: "57700753",
  水道橋: "58700750",
  御茶ノ水: "57700749",
  神楽坂: "58006350",
  九段下: "58406351",
  竹橋: "58006352",
  江戸川橋: "58306382",
  護国寺: "58306381",
  早稲田: "58006349",
  牛込神楽坂: "58909697",
  牛込柳町: "58909696",
  若松河田: "58909695",
  春日: "58906411",
  後楽園: "57706319",
  東大前: "58509069",
  麹町: "58306383",
  永田町: "58406384",
  // Lines 3–4 (Aoyama / Yoyogi)
  半蔵門: "58406391",
  青山一丁目: "58906314",
  外苑前: "57606315",
  表参道: "58406316",
  渋谷: "87100578",
  乃木坂: "58206371",
  赤坂: "58206370",
  明治神宮前: "58206372",
  代々木公園: "58206373",
  代々木上原: "58204991",
  初台: "86304925",
  幡ヶ谷: "86304926",
  笹塚: "86304927",
  神泉: "87104974",
  駒場東大前: "87104975",
  池ノ上: "87104976",
  下北沢: "87104977",
  池尻大橋: "88505091",
  三軒茶屋: "88505092",
  駒沢大学: "88505093",
  // Lines 5–6–8–10 (Meguro / Minato)
  中目黒: "88205051",
  代官山: "88205050",
  祐天寺: "88205052",
  学芸大学: "88205053",
  都立大学: "88205054",
  自由が丘: "88205055",
  目黒: "58700576",
  不動前: "88905068",
  武蔵小山: "88905069",
  恵比寿: "57900577",
  広尾: "57906347",
  六本木: "58906346",
  六本木一丁目: "58509213",
  神谷町: "57906345",
  溜池山王: "57609075",
  麻布十番: "58909214",
  赤羽橋: "58909703",
  白金高輪: "58709215",
  白金台: "58709216",
  三田: "58606402",
  泉岳寺: "58605181",
  高輪台: "58606401",
  五反田: "58600575",
  芝公園: "58706408",
  御成門: "58706409",
  // Saint Maur (Yokohama) ≤20 min transit
  元町・中華街: "201309867",
  石川町: "9300611",
  山手: "9300612",
  日本大通り: "201309866",
  馬車道: "201309865",
  みなとみらい: "201309864",
  新高島: "201309863",
  関内: "9300610",
  桜木町: "9300609",
  根岸: "9300613",
  磯子: "9300614",
  伊勢佐木長者町: "60406664",
  日ノ出町: "89405158",
  // Seibu Shinjuku (rent catchment)
  西武新宿: "43704822",
  高田馬場: "43700582",
  下落合: "43704823",
  中井: "43704824",
  新井薬師前: "43704825",
  沼袋: "43704826",
  野方: "43704827",
  都立家政: "43704828",
  鷺ノ宮: "43704829",
  下井草: "43704830",
  井荻: "43704831",
  上井草: "43704832",
  上石神井: "43704833",
  武蔵関: "43704834",
  東伏見: "43704835",
  西武柳沢: "43704836",
  田無: "43704837",
  花小金井: "43704838",
  小平: "43704839",
  久米川: "43704840",
  東村山: "43704841",
  所沢: "43704798",
  航空公園: "43704842",
  新所沢: "43704843",
  入曽: "43704844",
  狭山市: "43704845",
  新狭山: "43704846",
  南大塚: "43704847",
  本川越: "43704848",
  // Seibu Ikebukuro (rent catchment)
  椎名町: "42904784",
  東長崎: "42904785",
  江古田: "42904786",
  桜台: "42904787",
  練馬: "42904788",
  中村橋: "42904789",
  富士見台: "42904790",
  練馬高野台: "42907572",
  石神井公園: "42904791",
  大泉学園: "42904792",
  保谷: "42904793",
  ひばりヶ丘: "42904794",
  東久留米: "42904795",
  清瀬: "42904796",
  秋津: "42904797",
  西所沢: "42904799",
  小手指: "42904800",
  狭山ヶ丘: "42904801",
  武蔵藤沢: "42904802",
  稲荷山公園: "42904803",
  入間市: "42904804",
  仏子: "42904805",
  元加治: "42904806",
  飯能: "42904807",
  // JR Chuo-Sobu local / 総武線 (rent catchment)
  千葉: "19400208",
  西千葉: "19401917",
  稲毛: "19401918",
  新検見川: "19401919",
  幕張: "19401920",
  幕張本郷: "19401921",
  津田沼: "19401922",
  東船橋: "19401923",
  船橋: "19401924",
  西船橋: "19400708",
  下総中山: "19401925",
  本八幡: "19401926",
  市川: "19401927",
  小岩: "19401928",
  新小岩: "19401929",
  平井: "19401930",
  亀戸: "19401931",
  錦糸町: "19400207",
  両国: "19401932",
  浅草橋: "19401933",
  秋葉原: "19400592",
  信濃町: "19400754",
  千駄ケ谷: "19400755",
  代々木: "19400580",
  新宿: "19400231",
  大久保: "19400756",
  東中野: "19400757",
  中野: "19400758",
  高円寺: "19400759",
  阿佐ケ谷: "19400760",
  荻窪: "19400761",
  西荻窪: "19400762",
  吉祥寺: "19400763",
  三鷹: "19400242",
};

/** HOME'S list URL prefecture for each station name (default tokyo). */
const STATION_LIST_PREF = new Map([
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
  ].map((n) => [n, "kanagawa"]),
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
  ].map((n) => [n, "saitama"]),
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
  ].map((n) => [n, "chiba"]),
]);

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

/** Property-type search configs */
export const PROPERTY_TYPES = {
  kodate: {
    key: "kodate",
    label: "kodate",
    labelJa: "一戸建て",
    pathSegment: "kodate",
    baseType: "kodate",
    deal: "buy",
    hasListingKind: true,
    supportsMadori: true,
    supportsBuildingArea: true,
    supportsExclusiveArea: false,
    supportsLandArea: true,
    supportsParkingMcf: true,
    supportsBuildingAge: true,
    supportsFreehold: true,
    supportsConstructible: true,
  },
  mansion: {
    key: "mansion",
    label: "mansion",
    labelJa: "マンション",
    pathSegment: "mansion",
    baseType: "mansion",
    deal: "buy",
    hasListingKind: true,
    supportsMadori: true,
    supportsBuildingArea: false,
    supportsExclusiveArea: true,
    supportsLandArea: false,
    supportsParkingMcf: true,
    supportsBuildingAge: true,
    supportsFreehold: true,
    supportsConstructible: true,
  },
  tochi: {
    key: "tochi",
    label: "tochi",
    labelJa: "土地",
    pathSegment: "tochi",
    baseType: "tochi",
    deal: "buy",
    hasListingKind: false,
    supportsMadori: false,
    supportsBuildingArea: false,
    supportsExclusiveArea: false,
    supportsLandArea: true,
    supportsParkingMcf: false, // not in tochi こだわり modal
    supportsBuildingAge: false,
    supportsFreehold: true,
    supportsConstructible: true,
  },
  kodate_rent: {
    key: "kodate_rent",
    label: "kodate_rent",
    labelJa: "賃貸一戸建て",
    pathSegment: "kodate",
    baseType: "kodate",
    deal: "rent",
    hasListingKind: false,
    supportsMadori: true,
    supportsBuildingArea: false,
    supportsExclusiveArea: true,
    supportsLandArea: false,
    supportsParkingMcf: true,
    supportsBuildingAge: true,
    supportsFreehold: false,
    supportsConstructible: false,
  },
  mansion_rent: {
    key: "mansion_rent",
    label: "mansion_rent",
    labelJa: "賃貸マンション",
    pathSegment: "mansion",
    baseType: "mansion",
    deal: "rent",
    hasListingKind: false,
    supportsMadori: true,
    supportsBuildingArea: false,
    supportsExclusiveArea: true,
    supportsLandArea: false,
    supportsParkingMcf: true,
    supportsBuildingAge: true,
    supportsFreehold: false,
    supportsConstructible: false,
  },
};

function wardFromAddress(address) {
  if (!address) return { ward: null, wardEn: null };
  const addr = String(address);
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
    const t = String(builtText);
    if (/新築/.test(t)) return 0;
    const age = t.match(/築\s*(\d+)\s*年/);
    if (age) return Number(age[1]);
    const ym = t.match(/(\d{4})\s*年/);
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

/** HOME'S 築年数 select steps (年以内). */
const HOUSE_AGE_STEPS = [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

/** Nearest HOME'S houseageh step ≥ target (e.g. 22 → 25). */
function houseAgeCeil(maxYears) {
  if (maxYears == null) return null;
  for (const s of HOUSE_AGE_STEPS) {
    if (s >= maxYears) return s;
  }
  return HOUSE_AGE_STEPS[HOUSE_AGE_STEPS.length - 1];
}

function resolveListingAgeYears(it) {
  if (it.buildingAgeYears != null && Number.isFinite(it.buildingAgeYears)) {
    return it.buildingAgeYears;
  }
  const texts = [it.builtText, it.detail?.builtText, it.rawText, it.title].filter(Boolean);
  for (const text of texts) {
    const age = parseBuildingAge(text, it.yearBuilt ?? it.detail?.yearBuilt);
    if (age != null) return age;
  }
  return null;
}

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

/** HOME'S rent 賃料 select steps (万円). Return option value string. */
const MONTH_MONEY_STEPS = [
  "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5",
  "7.0", "7.5", "8.0", "8.5", "9.0", "9.5", "10", "10.5", "11", "11.5",
  "12", "12.5", "13", "13.5", "14", "14.5", "15", "15.5", "16", "16.5",
  "17", "17.5", "18", "18.5", "19", "19.5", "20", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30", "35", "40", "45", "50", "70", "100",
];

function monthMoneyCeil(manYen) {
  if (manYen == null) return null;
  for (const s of MONTH_MONEY_STEPS) {
    if (parseFloat(s) >= manYen) return s;
  }
  return MONTH_MONEY_STEPS[MONTH_MONEY_STEPS.length - 1];
}

function parseManYen(text) {
  if (!text) return null;
  const t = text.replace(/,/g, "").replace(/\s/g, "");
  const oku = t.match(/([\d.]+)\s*億/);
  const man = t.match(/([\d.]+)\s*万/);
  if (oku && man) return parseFloat(oku[1]) * 10000 + parseFloat(man[1]);
  if (oku) return parseFloat(oku[1]) * 10000;
  if (man) return parseFloat(man[1]);
  return null;
}

function parseSqm(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, "").match(/([\d.]+)\s*m/i);
  return m ? parseFloat(m[1]) : null;
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

/** HOME'S station key: 8-digit roseneki code, or `{slug}_{sid}` path segment. */
function isStationPath(code) {
  return /[a-z]/i.test(String(code));
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

/** @returns {Record<string, string[]>} HOME'S station keys keyed by pref slug. */
function resolveStationsByPref(names) {
  const byPref = { tokyo: [], kanagawa: [], saitama: [], chiba: [] };
  for (const name of names || []) {
    const code = STATION[name];
    if (!code) throw new Error(`Unknown station (add to STATION map): ${name}`);
    const pref = STATION_LIST_PREF.get(name) || "tokyo";
    if (!byPref[pref]) byPref[pref] = [];
    byPref[pref].push(code);
  }
  return byPref;
}

function splitStationKeys(stations) {
  const roseneki = [];
  const paths = [];
  for (const code of stations || []) {
    if (isStationPath(code)) paths.push(code);
    else roseneki.push(code);
  }
  return { roseneki, paths };
}

function stationPathListUrl(base, pathKey) {
  return base.replace(/\/list\/?$/, `/${pathKey}-st/list/`);
}

function normalizePrefectures(prefs) {
  const raw = prefs?.prefecture ?? "東京都";
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((p) => String(p).trim()).filter(Boolean);
}

function prefPathSlug(pref) {
  if (pref === "神奈川県" || pref === "kanagawa") return "kanagawa";
  if (pref === "埼玉県" || pref === "saitama") return "saitama";
  if (pref === "千葉県" || pref === "chiba") return "chiba";
  if (pref === "東京都" || pref === "tokyo") return "tokyo";
  throw new Error(`Unsupported prefecture (add slug map): ${pref}`);
}

function listingBase(typeCfg, prefs, prefOverride) {
  const prefsList = normalizePrefectures(prefs);
  const pref = prefPathSlug(prefOverride || prefsList[0] || "東京都");
  const seg = typeCfg.pathSegment;
  if (typeCfg.deal === "rent") {
    return `https://www.homes.co.jp/chintai/${seg}/${pref}/list/`;
  }
  if (!typeCfg.hasListingKind) {
    return `https://www.homes.co.jp/${seg}/${pref}/list/`;
  }
  const kind = prefs.listing === "shinchiku" ? "shinchiku" : "chuko";
  return `https://www.homes.co.jp/${seg}/${kind}/${pref}/list/`;
}

function buildCondParams(typeCfg, prefs, { cities = [], stations = [] } = {}) {
  const params = new URLSearchParams();
  const isRent = typeCfg.deal === "rent";

  for (const code of cities) {
    params.set(`cond[city][${code}]`, code);
  }
  for (const code of stations) {
    if (isStationPath(code)) continue; // path stations use /{slug}_{sid}-st/list/
    params.set(`cond[roseneki][${code}]`, code);
  }

  const priceMax = prefs.price?.max;
  const priceMin = prefs.price?.min;
  if (isRent) {
    if (priceMax != null) {
      params.set("cond[monthmoneyroomh]", String(monthMoneyCeil(priceMax)));
    }
    if (priceMin != null && priceMin > 0) {
      params.set("cond[monthmoneyroom]", String(monthMoneyCeil(priceMin)));
    }
  } else {
    if (priceMax != null) {
      params.set("cond[moneyroomh]", String(moneyroomCeil(priceMax)));
    }
    if (priceMin != null && priceMin > 0) {
      params.set("cond[moneyroom]", String(priceMin));
    }
  }

  if (typeCfg.supportsBuildingArea) {
    const bMin = prefs.building_area_m2?.min;
    if (bMin != null) params.set("cond[housearea]", String(bMin));
    const bMax = prefs.building_area_m2?.max;
    if (bMax != null) params.set("cond[houseareah]", String(bMax));
  }

  if (typeCfg.supportsExclusiveArea) {
    const eMin = prefs.exclusive_area_m2?.min;
    if (eMin != null) params.set("cond[housearea]", String(eMin));
    const eMax = prefs.exclusive_area_m2?.max;
    if (eMax != null) params.set("cond[houseareah]", String(eMax));
  }

  if (typeCfg.supportsLandArea) {
    const lMin = prefs.land_area_m2?.min;
    if (lMin != null) params.set("cond[landarea]", String(lMin));
    const lMax = prefs.land_area_m2?.max;
    if (lMax != null) params.set("cond[landareah]", String(lMax));
  }

  if (prefs.walk_minutes_max != null) {
    params.set("cond[walkminutesh]", String(prefs.walk_minutes_max));
  }
  if (prefs.include_bus_time) {
    params.set(isRent ? "cond[bustime]" : "cond[buswalk]", "1");
  }

  if (typeCfg.supportsMadori) {
    for (const label of prefs.madori || []) {
      const code = MADORI[label];
      if (!code) {
        console.warn(`unknown madori: ${label}`);
        continue;
      }
      params.set(`cond[madori][${code}]`, code);
    }
  }

  if (prefs.balcony_area_20m2_plus) {
    params.set("cond[balcony]", "1");
  }

  if (typeCfg.supportsBuildingAge && prefs.house_age_years_max != null) {
    const step = houseAgeCeil(prefs.house_age_years_max);
    if (step != null) params.set("cond[houseageh]", String(step));
  }

  // 建築条件 (tochi)
  if (prefs.building_condition === "建築条件付土地") {
    params.set("cond[buildingcond][1]", "1");
  } else if (prefs.building_condition === "建築条件なし土地") {
    params.set("cond[buildingcond][2]", "2");
  }

  const kodawari = [...(prefs.kodawari || [])].filter((label) => {
    if (isRent && label === "所有権") return false;
    return true;
  });
  if (typeCfg.supportsFreehold && prefs.freehold && !kodawari.includes("所有権")) {
    kodawari.push("所有権");
  }
  if (typeCfg.supportsParkingMcf && prefs.parking && !kodawari.includes("駐車場あり")) {
    kodawari.push("駐車場あり");
  }
  for (const label of kodawari) {
    if (label === "駐車場あり" && !typeCfg.supportsParkingMcf) {
      console.warn(`kodawari ${label} not supported for ${typeCfg.key}; skip`);
      continue;
    }
    const code = MCF[label];
    if (!code) {
      console.warn(`unknown kodawari (skip query param): ${label}`);
      continue;
    }
    params.set(`cond[mcf][${code}]`, code);
  }

  return params;
}

/** Expand location.station_sets (+ optional location.stations) into a flat stations list. */
export function expandLocation(doc, location) {
  const ku = [...(location?.ku || [])];
  const seen = new Set();
  const stations = [];
  const push = (name) => {
    const s = String(name || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    stations.push(s);
  };
  for (const s of location?.stations || []) push(s);
  const sets = doc?._station_sets || {};
  for (const key of location?.station_sets || []) {
    const list = sets[key];
    if (!list) throw new Error(`Unknown station_sets key: ${key}`);
    for (const s of list) push(s);
  }
  return { ku, stations, station_sets: location?.station_sets || [] };
}

export function loadTypePrefs(file, typeKey) {
  const doc = loadYaml(fs.readFileSync(file, "utf8"));
  const defaults = doc.defaults || {};
  const typeCfg = PROPERTY_TYPES[typeKey];
  if (!typeCfg) throw new Error(`Unknown property type: ${typeKey}`);

  const baseKey = typeCfg.baseType || typeKey;
  const typePrefs = doc[baseKey] || {};
  const merged = { ...defaults, ...typePrefs };
  const budget = defaults.budget || {};

  if (typeCfg.deal === "rent") {
    const rentCfg = doc.rent || {};
    if (rentCfg[baseKey] === false) {
      throw new Error(`Rent search disabled for ${baseKey} in preferences (rent.${baseKey}: false)`);
    }
    const rentOverrides = rentCfg.overrides?.[baseKey];
    if (rentOverrides && typeof rentOverrides === "object") {
      Object.assign(merged, rentOverrides);
    }
    // Map kodate building area → exclusive area for chintai housearea filter
    let exclusive = merged.exclusive_area_m2 || null;
    if (!exclusive && merged.building_area_m2) {
      exclusive = merged.building_area_m2;
    }
    merged.exclusive_area_m2 = exclusive;
    merged.price = {
      min: merged.rent_price?.min ?? null,
      max: merged.rent_price?.max ?? budget.rent_max ?? null,
    };
    merged.freehold = false;
    merged.constructible = false;
    merged.kodawari = (merged.kodawari || []).filter((k) => k !== "所有権");
  } else {
    merged.price = {
      min: typePrefs.price?.min ?? null,
      max: typePrefs.price?.max ?? budget.buy_max ?? null,
    };
  }

  merged.location = expandLocation(doc, merged.location || {});
  return merged;
}

export function parseSearchArgs(argv, typeKey) {
  const out = {
    prefs: path.join(root, "config/preferences.yaml"),
    out: path.join(root, `output/${typeKey}.json`),
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

async function scrapeListPage(page, pathSegment) {
  return page.evaluate((seg) => {
    const idRe = new RegExp(`/${seg}/(b-\\d+)/`);
    const hrefNeedle = `/${seg}/b-`;

    // Kodate/mansion: .prg-building. Tochi: both .prg-kksBukken (PR/horizontal)
    // and .prg-building (compact specs). Prefer union, dedupe by id.
    const seenEls = new Set();
    const cards = [];
    for (const sel of [".prg-kksBukken", ".prg-building"]) {
      for (const card of document.querySelectorAll(sel)) {
        if (seenEls.has(card)) continue;
        if (!card.querySelector(`a[href*="${hrefNeedle}"]`)) continue;
        seenEls.add(card);
        cards.push(card);
      }
    }

    function cellText(el) {
      return (el?.textContent || "").trim().replace(/\s+/g, " ");
    }

    function looksLikeHeaderRow(cells) {
      return (
        cells.some((h) => /^(価格|所在地|交通|土地面積|建物面積|専有面積|間取り|築)/.test(h)) &&
        !cells.some((h) => /\d[\d,]*\s*万円/.test(h) || /[\d.]+\s*(?:m[²2]|㎡)/i.test(h))
      );
    }

    function isPriceValue(v) {
      return /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*万円/.test(String(v || ""));
    }

    function isAreaValue(v) {
      return /[\d,.]+\s*(?:m[²2]|㎡)/i.test(String(v || ""));
    }

    function fillFromHorizontalTables(card, cellMap) {
      const rows = [...card.querySelectorAll("tr")];
      for (let r = 0; r + 1 < rows.length; r++) {
        const headers = [...rows[r].querySelectorAll("th,td")].map(cellText);
        const values = [...rows[r + 1].querySelectorAll("th,td")].map(cellText);
        if (!looksLikeHeaderRow(headers)) continue;
        headers.forEach((h, i) => {
          if (!h || !values[i]) return;
          const key = h.replace(/\/.*$/, ""); // "土地面積/坪" → "土地面積"
          cellMap[key] = values[i];
          cellMap[h] = values[i];
        });
      }
    }

    function fillFromRawText(raw, cellMap) {
      if (!isPriceValue(cellMap["価格"])) {
        const m = raw.match(/((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*万円/);
        if (m) cellMap["価格"] = `${m[1]}万円`;
      }
      if (!isAreaValue(cellMap["土地面積"])) {
        const m = raw.match(/([\d,.]+)\s*(?:m[²2]|㎡)/i);
        if (m) cellMap["土地面積"] = `${m[1]}m²`;
      }
    }

    const byId = new Map();
    for (const card of cards) {
      const link = card.querySelector(`a[href*="${hrefNeedle}"]`);
      const href = (link?.href || "").split("?")[0];
      const idMatch = href.match(idRe);
      if (!idMatch) continue;

      const cellMap = {};
      card.querySelectorAll("tr").forEach((tr) => {
        const cells = [...tr.querySelectorAll("th,td")].map(cellText);
        if (looksLikeHeaderRow(cells)) return; // don't pair header labels with each other
        for (let i = 0; i + 1 < cells.length; i += 2) {
          if (cells[i] && cells[i + 1] && cells[i].length < 20) {
            const key = cells[i].replace(/\/.*$/, "");
            cellMap[key] = cells[i + 1];
            cellMap[cells[i]] = cells[i + 1];
          }
        }
      });
      fillFromHorizontalTables(card, cellMap);

      const builtText =
        cellMap["築年数"] || cellMap["築年月"] || cellMap["建築年"] || cellMap["建築年（築年数）"] || null;

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
      if (!title) {
        const heading = card.querySelector("h2,h3,.moduleHead");
        title = (heading?.textContent || "").replace(/\s+/g, " ").trim();
      }

      const raw = (card.innerText || "").replace(/\t/g, " ");
      fillFromRawText(raw, cellMap);
      const walkMatch = raw.match(/徒歩\s*(\d+)\s*分/);

      // Skip agent-only chrome with no listing specs
      if (!isPriceValue(cellMap["価格"]) && !isAreaValue(cellMap["土地面積"]) && !isAreaValue(cellMap["建物面積"]) && !isAreaValue(cellMap["専有面積"])) {
        if (!cellMap["間取り"] && !builtText) continue;
      }

      const address =
        (cellMap["所在地"] && !/^(価格|交通|土地面積|建物面積)/.test(cellMap["所在地"])
          ? cellMap["所在地"]
          : null) ||
        (raw.match(/((?:東京都|神奈川県|埼玉県|千葉県)[^\s]{2,40})/) || [])[1] ||
        null;

      const row = {
        id: idMatch[1],
        url: href,
        title: title.slice(0, 120),
        imageUrl: mainImg ? mainImg.currentSrc || mainImg.src : null,
        priceText: isPriceValue(cellMap["価格"]) ? cellMap["価格"] : null,
        madori: (cellMap["間取り"] || "").split(/\s+/)[0] || null,
        landAreaText: isAreaValue(cellMap["土地面積"])
          ? cellMap["土地面積"]
          : isAreaValue(cellMap["土地面積/坪"])
            ? cellMap["土地面積/坪"]
            : null,
        buildingAreaText: cellMap["建物面積"] || cellMap["専有面積"] || null,
        exclusiveAreaText: cellMap["専有面積"] || null,
        builtText,
        walkMinutes: walkMatch ? Number(walkMatch[1]) : null,
        address,
        googleMapsUrl: address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
          : null,
        rawText: raw.replace(/<[^>]+>/g, " ").slice(0, 500),
        deal: "buy",
      };

      const prev = byId.get(row.id);
      if (!prev) {
        byId.set(row.id, row);
        continue;
      }
      // Prefer the card that has price / land area filled in
      const score = (r) => (r.priceText ? 2 : 0) + (r.landAreaText || r.buildingAreaText ? 1 : 0) + (r.title ? 1 : 0);
      if (score(row) > score(prev)) byId.set(row.id, row);
    }
    return [...byId.values()];
  }, pathSegment);
}

/**
 * Parse HOME'S rent fee token: 無/なし/- / Nヶ月 / N円 / N万円.
 * @returns {{ months: number|null, yen: number|null }}
 */
function parseRentFeeToken(token) {
  const t = String(token || "").trim();
  if (!t) return { months: null, yen: null };
  if (/^(?:無|なし|[-ー－]|―|—)$/.test(t)) return { months: 0, yen: 0 };
  const months = t.match(/^([\d.]+)\s*ヶ月$/);
  if (months) return { months: parseFloat(months[1]), yen: null };
  const man = t.match(/^([\d.]+)\s*万(?:円)?$/);
  if (man) return { months: null, yen: parseFloat(man[1]) * 10000 };
  const yen = t.match(/^([\d,]+)\s*円$/);
  if (yen) return { months: null, yen: Number(yen[1].replace(/,/g, "")) };
  return { months: null, yen: null };
}

/** Convert fee token to 万円 using rent (万円/月) when token is in months. */
function feeTokenToManYen(token, rentManYen) {
  const { months, yen } = parseRentFeeToken(token);
  if (yen != null) return Math.round((yen / 10000) * 100) / 100;
  if (months != null && rentManYen != null) {
    return Math.round(months * rentManYen * 100) / 100;
  }
  return null;
}

/**
 * Estimate move-in one-off (万円): 敷金 + 礼金 + 保証金 + 仲介(assume 1 month).
 * 敷引・償却 excluded (taken from deposit later). First month rent excluded.
 */
function estimateRentOneOffManYen({
  rentManYen,
  shikikinToken,
  reikinToken,
  guaranteeToken,
  agentMonths = 1,
}) {
  if (rentManYen == null || !Number.isFinite(rentManYen)) return null;
  const parts = [
    feeTokenToManYen(shikikinToken, rentManYen),
    feeTokenToManYen(reikinToken, rentManYen),
    feeTokenToManYen(guaranteeToken, rentManYen),
    Math.round(agentMonths * rentManYen * 100) / 100,
  ];
  if (parts.some((p) => p == null)) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** Rent list pages: one row per room (.prg-room with /chintai/room/ link). */
async function scrapeRentListPage(page) {
  return page.evaluate(() => {
    const feePart = "(?:無|なし|[-ー－]|―|—|[\\d.]+ヶ月|[\\d,]+円|[\\d.]+万円)";
    const feesRe = new RegExp(
      `([\\d.]+)\\s*万円\\s*/\\s*(\\S+)\\s+(${feePart})/(${feePart})/(${feePart})/(${feePart})`
    );

    const rooms = [...document.querySelectorAll(".prg-room")];
    return rooms
      .map((room) => {
        const link = room.querySelector("a[href*='/chintai/room/']");
        const href = (link?.href || "").split("?")[0];
        const idMatch = href.match(/\/room\/([a-f0-9]+)/);
        if (!idMatch) return null;

        let root = room.parentElement;
        for (let i = 0; i < 14 && root; i++) {
          if (root.querySelector?.(".bukkenSpec") && root.contains(room)) break;
          root = root.parentElement;
        }
        const spec = root?.querySelector(".bukkenSpec") || null;
        const specText = (spec?.innerText || "").replace(/\s+/g, " ");
        const buildingText = (root?.innerText || "").replace(/\s+/g, " ");
        const raw = (room.innerText || "").replace(/\s+/g, " ").trim();

        const priceMatch = raw.match(/([\d.]+)\s*万円/);
        const feesMatch = raw.match(feesRe);
        const madoriMatch = raw.match(/\b(\d(?:SLDK|LDK|DK|K)|ワンルーム)\b/);
        const areaMatch = raw.match(/([\d.]+)\s*m[²2]/i);
        const walkMatch = (specText || buildingText).match(/徒歩\s*(\d+)\s*分/);
        const builtMatch =
          (specText || buildingText).match(/築\s*(\d+)\s*年/) ||
          (specText || buildingText).match(/(\d+)\s*年\s*[\/／]/);
        const address =
          spec?.querySelector("td.address")?.textContent?.trim() ||
          (specText.match(/所在地\s+([^\s]+(?:\s+[^\s]+)?)/) || [])[1] ||
          null;

        const titleImg = [...(root || room).querySelectorAll("img")].find((img) => {
          const alt = img.alt || "";
          return alt && !/^掲載|閲覧|お気に入り|間取り/.test(alt);
        });
        let title = (titleImg?.alt || "")
          .replace(/の(リビング|外観|キッチン|浴室|トイレ|間取り).*$/, "")
          .trim();
        if (!title) title = (link?.getAttribute("title") || "").trim();

        const imgs = [...(root || room).querySelectorAll("img")].filter((img) => {
          const src = img.currentSrc || img.src || img.getAttribute("data-src") || "";
          return (
            src &&
            /homes\.jp|image\.|img\.|cdn/.test(src) &&
            !/logo|icon|sprite|loading|visited|default|utility/i.test(src)
          );
        });
        const mainImg = imgs[0];
        const areaText = areaMatch ? `${areaMatch[1]}m²` : null;
        const ageYears = builtMatch ? Number(builtMatch[1]) : null;

        const managementFeeText = feesMatch ? feesMatch[2] : null;
        const shikikinText = feesMatch ? feesMatch[3] : null;
        const reikinText = feesMatch ? feesMatch[4] : null;
        const guaranteeText = feesMatch ? feesMatch[5] : null;
        const shikibikiText = feesMatch ? feesMatch[6] : null;

        return {
          id: idMatch[1],
          url: href,
          title: title.slice(0, 120),
          imageUrl: mainImg
            ? mainImg.currentSrc || mainImg.src || mainImg.getAttribute("data-src")
            : null,
          priceText: priceMatch ? `${priceMatch[1]}万円` : null,
          madori: madoriMatch?.[1] || null,
          landAreaText: null,
          buildingAreaText: areaText,
          exclusiveAreaText: areaText,
          builtText: ageYears != null ? `築${ageYears}年` : null,
          walkMinutes: walkMatch ? Number(walkMatch[1]) : null,
          address,
          managementFeeText,
          shikikinText,
          reikinText,
          guaranteeText,
          shikibikiText,
          rawText: raw.slice(0, 500),
          deal: "rent",
        };
      })
      .filter(Boolean);
  });
}

function isNavRaceError(err) {
  const msg = String(err?.message || err);
  return /Execution context was destroyed|Most likely because of a navigation|Target closed/i.test(msg);
}

function isTimeoutError(err) {
  const name = err?.name || "";
  const msg = String(err?.message || err);
  return name === "TimeoutError" || /Timeout \d+ms exceeded/i.test(msg);
}

function isRetryableNavError(err) {
  return isNavRaceError(err) || isTimeoutError(err);
}

/** HOME'S list pages often soft-redirect after first paint; wait + retry evaluates. */
async function gotoListAndSettle(page, url) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (!isRetryableNavError(err) || attempt === 2) throw err;
      console.error(`  goto timeout/race, retry ${attempt + 1}/3`);
      await new Promise((r) => setTimeout(r, 1000 + attempt * 1500));
    }
  }
  if (lastErr) throw lastErr;
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* slow third-parties — ignore */
  }
  await new Promise((r) => setTimeout(r, 600));
  try {
    await page.waitForSelector("body", { state: "attached", timeout: 10000 });
  } catch {
    /* continue; retry below may still succeed */
  }
}

async function evaluateStable(page, fn, arg) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 });
      } catch {
        /* ignore */
      }
      return arg === undefined ? await page.evaluate(fn) : await page.evaluate(fn, arg);
    } catch (err) {
      lastErr = err;
      if (!isNavRaceError(err)) throw err;
      await new Promise((r) => setTimeout(r, 400 + attempt * 350));
    }
  }
  throw lastErr;
}

async function scrapeAllPages(page, listUrl, typeCfg) {
  const results = [];
  let pageNo = 1;
  let guard = 0;
  while (guard++ < 100) {
    const url =
      pageNo === 1
        ? listUrl
        : `${listUrl}${listUrl.includes("?") ? "&" : "?"}page=${pageNo}`;

    let count = null;
    let batch = [];
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await gotoListAndSettle(page, url);
        count = await evaluateStable(page, () => {
          const t = document.body.innerText || "";
          const m = t.match(/([\d,]+)\s*件/);
          return m ? Number(m[1].replace(/,/g, "")) : null;
        });
        batch =
          typeCfg.deal === "rent"
            ? await scrapeRentListPage(page)
            : await scrapeListPage(page, typeCfg.pathSegment);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (!isRetryableNavError(err)) throw err;
        console.error(`  page ${pageNo}: ${isTimeoutError(err) ? "timeout" : "nav race"}, retry ${attempt + 1}/3`);
        await new Promise((r) => setTimeout(r, 700 + attempt * 500));
      }
    }
    if (lastErr) throw lastErr;

    if (!batch.length) break;
    results.push(...batch);
    console.error(`  page ${pageNo}: +${batch.length} (site says ${count ?? "?"} total)`);
    if (count != null && results.length >= count) break;
    const hasNext = await page.locator(`a[href*="page=${pageNo + 1}"]`).count();
    if (!hasNext) break;
    pageNo += 1;
  }
  return results;
}

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
      locationAccuracy: "coordinates",
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

function parsePublishedAt(text) {
  if (!text) return null;
  const s = String(text);
  // e.g. 情報公開日：2026/09/06（24日前 公開）
  const m =
    s.match(/情報公開日\s*[:：]?\s*(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/) ||
    s.match(/公開日\s*[:：]?\s*(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every(Number.isFinite)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
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
        const v = m ? m[1].trim().slice(0, 120) : null;
        return v || null;
      };

      const mapEl = document.querySelector("map-viewer-google-map[data-lat][data-lon]");
      let lat = mapEl ? Number(mapEl.getAttribute("data-lat")) : null;
      let lon = mapEl ? Number(mapEl.getAttribute("data-lon")) : null;

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        for (const s of document.querySelectorAll("script")) {
          const t = s.textContent || "";
          const m =
            t.match(/latitude["\s:=]+([\d.]+)[\s\S]{0,80}?longitude["\s:=]+([\d.]+)/i) ||
            t.match(/"lat"\s*:\s*([\d.]+)[\s\S]{0,40}?"lng"\s*:\s*([\d.]+)/) ||
            t.match(/"lat"\s*:\s*([\d.]+)[\s\S]{0,40}?"lon"\s*:\s*([\d.]+)/);
          if (m) {
            lat = Number(m[1]);
            lon = Number(m[2]);
            break;
          }
        }
      }

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

      const pricePick = pick("価格");
      const priceMatch =
        (pricePick && pricePick.match(/((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*万円/)) ||
        text.match(/価格[^\n]{0,40}?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*万円/);
      const landPick = pick("土地面積/坪") || pick("土地面積");
      const landMatch =
        (landPick && landPick.match(/([\d,.]+)\s*(?:m[²2]|㎡)/i)) ||
        text.match(/土地面積[^\n]{0,40}?([\d,.]+)\s*(?:m[²2]|㎡)/i);

      const publishedLine =
        (text.match(/情報公開日\s*[:：]?\s*[^\n]+/) || text.match(/公開日\s*[:：]?\s*[^\n]+/) || [])[0] ||
        null;

      // Also pick fee labels from detail for rent
      const shikikinReikin = text.match(/敷金\s*[\/／]\s*礼金\s*\n?\s*([^\n]+)/);
      let shikikinText = null;
      let reikinText = null;
      if (shikikinReikin) {
        const parts = shikikinReikin[1].split(/[\/／]/).map((s) => s.trim());
        if (parts.length >= 2) {
          shikikinText = parts[0];
          reikinText = parts[1];
        }
      }
      const guaranteeLine = text.match(/保証金\s*[\/／]\s*敷引[・･]償却金?\s*\n?\s*([^\n]+)/);
      let guaranteeText = null;
      let shikibikiText = null;
      if (guaranteeLine) {
        const parts = guaranteeLine[1].split(/[\/／]/).map((s) => s.trim());
        if (parts.length >= 2) {
          guaranteeText = parts[0];
          shikibikiText = parts[1];
        }
      }
      const managementFee =
        (text.match(/管理費等\s*\n?\s*([^\n]+)/) || [])[1]?.trim() || null;

      return {
        landRight: pick("土地の権利") || pick("土地権利"),
        leaseType: pick("借地権の種類・期間"),
        zoning: pick("用途地域"),
        cityPlan: pick("都市計画"),
        landUse: pick("地目"),
        rebuildForbidden: /再建築不可|建築不可/.test(text),
        freeholdMention:
          /土地の権利\s*所有権/.test(text) ||
          /土地権利\s*所有権/.test(text) ||
          /所有権/.test(pick("土地の権利") || pick("土地権利") || ""),
        priceText: priceMatch ? `${priceMatch[1]}万円` : null,
        landAreaText: landMatch ? `${landMatch[1]}m²` : landPick || null,
        publishedText: publishedLine,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        address: address || null,
        postalCode,
        yearBuilt: Number.isFinite(yearBuilt) ? yearBuilt : null,
        builtText: builtText || null,
        structure: structure || null,
        imageUrl: imageUrl || null,
        shikikinText,
        reikinText,
        guaranteeText,
        shikibikiText,
        managementFeeText: managementFee,
      };
    });

    const location = buildGoogleMapsLocation(detail);
    const { ward, wardEn } = wardFromAddress(detail.address || location.address);
    const buildingAgeYears = parseBuildingAge(detail.builtText, detail.yearBuilt);
    const storeys = parseStoreys(detail.structure);
    const publishedAt = parsePublishedAt(detail.publishedText) || item.publishedAt || null;

    const shikikinText = item.shikikinText || detail.shikikinText || null;
    const reikinText = item.reikinText || detail.reikinText || null;
    const guaranteeText = item.guaranteeText || detail.guaranteeText || null;
    const shikibikiText = item.shikibikiText || detail.shikibikiText || null;
    const managementFeeText = item.managementFeeText || detail.managementFeeText || null;
    const priceText = item.priceText || detail.priceText || null;

    const base = {
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
      priceText,
      landAreaText: item.landAreaText || detail.landAreaText || null,
      publishedAt,
      publishedText: detail.publishedText || item.publishedText || null,
    };

    if (item.deal !== "rent") return base;

    const rentManYen = parseManYen(priceText);
    const reikin = parseRentFeeToken(reikinText);
    const oneOffManYen = estimateRentOneOffManYen({
      rentManYen,
      shikikinToken: shikikinText,
      reikinToken: reikinText,
      guaranteeToken: guaranteeText,
    });

    return {
      ...base,
      shikikinText,
      reikinText,
      guaranteeText,
      shikibikiText,
      managementFeeText,
      reikinMonths: reikin.months,
      reikinYen: reikin.yen,
      shikikinMonths: parseRentFeeToken(shikikinText).months,
      oneOffManYen: oneOffManYen ?? item.oneOffManYen ?? null,
      oneOffAssumesAgentMonths: 1,
    };
  } catch (e) {
    return { ...item, detailError: String(e.message || e) };
  } finally {
    await page.close();
  }
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

function clientFilter(typeCfg, items, prefs, { strictAge = false } = {}) {
  return items.filter((it) => {
    const price = parseManYen(it.priceText);
    it.priceManYen = price;
    if (prefs.price?.max != null && price != null && price > prefs.price.max) return false;

    if (typeCfg.deal === "rent") {
      const reikin = parseRentFeeToken(it.reikinText);
      it.reikinMonths = reikin.months;
      it.reikinYen = reikin.yen;
      it.shikikinMonths = parseRentFeeToken(it.shikikinText).months;
      it.oneOffManYen = estimateRentOneOffManYen({
        rentManYen: price,
        shikikinToken: it.shikikinText,
        reikinToken: it.reikinText,
        guaranteeToken: it.guaranteeText,
      });
      it.oneOffAssumesAgentMonths = 1;
    }

    if (typeCfg.supportsBuildingArea) {
      const bArea = parseSqm(it.buildingAreaText);
      it.buildingAreaM2 = bArea;
      if (prefs.building_area_m2?.min != null && bArea != null && bArea < prefs.building_area_m2.min) {
        return false;
      }
    }

    if (typeCfg.supportsExclusiveArea) {
      const eArea = parseSqm(it.exclusiveAreaText || it.buildingAreaText);
      it.exclusiveAreaM2 = eArea;
      it.buildingAreaM2 = eArea; // help dedupe / UI reuse
      if (prefs.exclusive_area_m2?.min != null && eArea != null && eArea < prefs.exclusive_area_m2.min) {
        return false;
      }
    }

    if (typeCfg.supportsLandArea) {
      const lArea = parseSqm(it.landAreaText);
      it.landAreaM2 = lArea;
      if (prefs.land_area_m2?.min != null && lArea != null && lArea < prefs.land_area_m2.min) {
        return false;
      }
    }

    if (prefs.walk_minutes_max != null && it.walkMinutes != null && it.walkMinutes > prefs.walk_minutes_max) {
      return false;
    }

    if (
      typeCfg.supportsConstructible &&
      prefs.constructible &&
      (/再建築不可|再建不|建築不可/.test(it.rawText || "") ||
        /再建築不可|再建不|建築不可/.test(it.title || "") ||
        it.detail?.rebuildForbidden)
    ) {
      return false;
    }

    if (
      typeCfg.supportsFreehold &&
      prefs.freehold &&
      it.detail &&
      it.detail.landRight &&
      !/所有権/.test(it.detail.landRight)
    ) {
      return false;
    }

    const maxAge = prefs.house_age_years_max;
    if (typeCfg.supportsBuildingAge && maxAge != null) {
      const age = resolveListingAgeYears(it);
      if (age != null) {
        it.buildingAgeYears = age;
        if (age > maxAge) return false;
      } else if (strictAge) {
        return false;
      }
    }

    return true;
  });
}

function filtersPayload(typeCfg, prefs) {
  const filters = {
    type: typeCfg.key,
    deal: typeCfg.deal,
    ku: prefs.location?.ku || [],
    stations: prefs.location?.stations || [],
    priceMaxManYen: prefs.price?.max ?? null,
    walkMinutesMax: prefs.walk_minutes_max ?? null,
    freehold: typeCfg.supportsFreehold ? !!prefs.freehold : false,
    constructible: typeCfg.supportsConstructible ? !!prefs.constructible : false,
    parking: !!prefs.parking,
  };
  if (typeCfg.hasListingKind) filters.listing = prefs.listing;
  if (typeCfg.supportsMadori) filters.madori = prefs.madori || [];
  if (typeCfg.supportsBuildingArea) filters.buildingAreaMinM2 = prefs.building_area_m2?.min ?? null;
  if (typeCfg.supportsExclusiveArea) filters.exclusiveAreaMinM2 = prefs.exclusive_area_m2?.min ?? null;
  if (typeCfg.supportsLandArea) filters.landAreaMinM2 = prefs.land_area_m2?.min ?? null;
  if (typeCfg.supportsBuildingAge && prefs.house_age_years_max != null) {
    filters.houseAgeYearsMax = prefs.house_age_years_max;
    filters.houseAgeQueryStep = houseAgeCeil(prefs.house_age_years_max);
  }
  return filters;
}

/**
 * Run a full scrape for one property type.
 * @param {"kodate"|"mansion"|"tochi"|"kodate_rent"|"mansion_rent"} typeKey
 * @param {string[]} argv process.argv.slice(2)
 */
export async function runHomesSearch(typeKey, argv = []) {
  const typeCfg = PROPERTY_TYPES[typeKey];
  if (!typeCfg) throw new Error(`Unknown property type: ${typeKey}`);

  const args = parseSearchArgs(argv, typeKey);
  const prefs = loadTypePrefs(args.prefs, typeKey);
  const cities = resolveCities(prefs.location?.ku || []);
  const stationsByPref = resolveStationsByPref(prefs.location?.stations || []);
  const prefsList = normalizePrefectures(prefs);
  const prefBases = {
    tokyo: listingBase(typeCfg, prefs, "東京都"),
    kanagawa: listingBase(typeCfg, prefs, "神奈川県"),
    saitama: listingBase(typeCfg, prefs, "埼玉県"),
    chiba: listingBase(typeCfg, prefs, "千葉県"),
  };

  console.error("type:", typeKey);
  console.error("deal:", typeCfg.deal);
  console.error("prefs:", args.prefs);
  if (typeCfg.hasListingKind) console.error("listing:", prefs.listing);
  console.error("prefecture:", prefsList.join(", "));
  console.error("ku:", prefs.location?.ku?.join(", "));
  console.error("stations:", prefs.location?.stations?.join(", "));
  console.error(
    "stations by pref: " +
      Object.entries(stationsByPref)
        .map(([k, v]) => `${k}=${v.length}`)
        .join(", ")
  );
  console.error(
    typeCfg.deal === "rent"
      ? `rent max: ${prefs.price?.max ?? "—"} 万円/月`
      : `buy max: ${prefs.price?.max ?? "—"} 万円`
  );
  if (typeCfg.supportsBuildingAge && prefs.house_age_years_max != null) {
    const step = houseAgeCeil(prefs.house_age_years_max);
    console.error(
      `house age max: ${prefs.house_age_years_max} (HOME'S query: ${step}年以内, client re-filter exact)`
    );
  }

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
      // ku codes are Tokyo wards today — search tokyo list
      const q = buildCondParams(typeCfg, prefs, { cities });
      const url = `${prefBases.tokyo}?${q.toString()}`;
      console.error("\n[ku search]", url.slice(0, 120) + "…");
      const rows = await scrapeAllPages(page, url, typeCfg);
      for (const r of rows) {
        byId.set(r.id, { ...r, matchedVia: ["ku"] });
      }
    }

    const mergeStationRows = (rows) => {
      for (const r of rows) {
        const prev = byId.get(r.id);
        if (prev) {
          prev.matchedVia = [...new Set([...(prev.matchedVia || []), "station"])];
        } else {
          byId.set(r.id, { ...r, matchedVia: ["station"] });
        }
      }
    };

    const searchStationsOnBase = async (base, codes, label) => {
      if (!codes.length) return;
      const { roseneki, paths } = splitStationKeys(codes);
      if (roseneki.length) {
        const q = buildCondParams(typeCfg, prefs, { stations: roseneki });
        const url = `${base}?${q.toString()}`;
        console.error(`\n[station search ${label}]`, url.slice(0, 120) + "…");
        mergeStationRows(await scrapeAllPages(page, url, typeCfg));
      }
      for (const pathKey of paths) {
        const q = buildCondParams(typeCfg, prefs, { stations: [] });
        const url = `${stationPathListUrl(base, pathKey)}?${q.toString()}`;
        console.error(`\n[station path ${label}]`, pathKey, url.slice(0, 120) + "…");
        try {
          mergeStationRows(await scrapeAllPages(page, url, typeCfg));
        } catch (err) {
          if (!isRetryableNavError(err)) throw err;
          console.error(
            `[station path ${label}] ${pathKey}: giving up after retries (${err?.name || "error"}: ${String(err?.message || err).slice(0, 120)})`
          );
        }
      }
    };

    for (const [pref, codes] of Object.entries(stationsByPref)) {
      await searchStationsOnBase(prefBases[pref], codes, pref);
    }

    let items = [...byId.values()];
    console.error(`\nunique before client filter: ${items.length}`);

    items = clientFilter(typeCfg, items, prefs, { strictAge: false });
    console.error(`after list client filter: ${items.length}`);

    if (!args.skipDetail && items.length) {
      console.error(`detail enrich (maps / freehold / constructible)…`);
      items = await mapPool(items, 3, (it) => enrichDetail(context, it));
      items = clientFilter(typeCfg, items, prefs, { strictAge: true });
      console.error(`after detail filter: ${items.length}`);
    } else if (args.skipDetail) {
      console.error("skip-detail: no googleMapsUrl / detail checks");
      items = clientFilter(typeCfg, items, prefs, { strictAge: true });
      console.error(`after age-only strict filter: ${items.length}`);
    }

    const beforeDedupe = items.length;
    const deduped = dedupeListings(items);
    items = deduped.listings;
    console.error(
      `after dedupe: ${items.length} (removed ${deduped.removed.length} across ${deduped.clusters} clusters)`
    );

    items.sort((a, b) => (a.priceManYen ?? 1e12) - (b.priceManYen ?? 1e12));

    let previousIds = null;
    if (fs.existsSync(args.out)) {
      try {
        const previous = JSON.parse(fs.readFileSync(args.out, "utf8"));
        previousIds = new Set((previous.listings || []).map((it) => it.id));
      } catch {
        previousIds = null;
      }
    }

    const currentIds = new Set(items.map((it) => it.id));
    const addedIds = previousIds
      ? [...currentIds].filter((id) => !previousIds.has(id))
      : [];
    const removedIds = previousIds
      ? [...previousIds].filter((id) => !currentIds.has(id))
      : [];

    for (const it of items) {
      if (addedIds.includes(it.id)) it.isNew = true;
    }

    const payload = {
      scrapedAt: new Date().toISOString(),
      source: "homes.co.jp",
      type: typeKey,
      deal: typeCfg.deal,
      prefsFile: path.relative(root, args.prefs),
      filters: filtersPayload(typeCfg, prefs),
      count: items.length,
      delta: {
        addedCount: addedIds.length,
        removedCount: removedIds.length,
        addedIds,
        removedIds,
      },
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
    const priceUnit = typeCfg.deal === "rent" ? "万円/月" : "万円";

    console.log(`Found ${items.length} ${typeCfg.labelJa} listing(s).`);
    if (previousIds) {
      console.log(`Since last run: +${addedIds.length} added, -${removedIds.length} removed.`);
    } else {
      console.log(`Since last run: no previous results (first run for this type).`);
    }
    if (deduped.removed.length) {
      console.log(`Deduped: removed ${deduped.removed.length} duplicate posting(s).`);
    }
    if (prices.length) {
      console.log(`Price range: ${priceMin.toLocaleString()}–${priceMax.toLocaleString()} ${priceUnit}`);
    }
    console.log(`Matched via: ku=${viaKu}, station=${viaStation}`);
    if (!args.skipDetail) {
      console.log(`Google Maps URLs: ${withMaps}/${items.length}`);
    }
    console.log(`Results: ${args.out}`);
    return payload;
  } finally {
    await browser.close();
  }
}
