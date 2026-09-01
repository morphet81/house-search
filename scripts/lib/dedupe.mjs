/**
 * Deduplicate HOME'S listings that are the same physical property
 * posted by different agencies.
 *
 * Match rule (investigated on Tokyo kodate output):
 * - Same map pin within MAX_DISTANCE_M, AND building floor area within
 *   AREA_EPS_M2 → treat as same house (land area / price / photos often differ).
 * - Fallback without area: within TIGHT_DISTANCE_M + same price + same madori.
 * - Fallback without coords: banchi-level address (must include a number) +
 *   building area match + price within PRICE_EPS_RATIO.
 *
 * Keep the richer listing (photo, precise address, filled detail fields).
 */

export const MAX_DISTANCE_M = 25;
export const TIGHT_DISTANCE_M = 15;
export const AREA_EPS_M2 = 0.5;
export const PRICE_EPS_RATIO = 0.05;

export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parseLandM2(text) {
  if (text == null) return null;
  if (typeof text === "number") return text;
  const m = String(text).replace(/,/g, "").match(/([\d.]+)\s*m/i);
  return m ? parseFloat(m[1]) : null;
}

export function buildingAreaM2(it) {
  if (it.buildingAreaM2 != null) return Number(it.buildingAreaM2);
  return parseLandM2(it.buildingAreaText);
}

export function priceManYen(it) {
  if (it.priceManYen != null) return Number(it.priceManYen);
  return null;
}

/** Prefer address strings that include a building number (番/号/digits after 丁目). */
export function addressPrecisionScore(addr) {
  if (!addr) return 0;
  let s = 0;
  if (/[0-9０-９]/.test(addr)) s += 3;
  if (/番|号|-/.test(addr)) s += 2;
  if (/丁目/.test(addr)) s += 1;
  s += Math.min(3, Math.floor(String(addr).length / 12));
  return s;
}

export function richnessScore(it) {
  let s = 0;
  if (it.imageUrl || it.detail?.imageUrl) s += 12;
  s += addressPrecisionScore(it.address || it.detail?.address);
  if (it.title) s += Math.min(6, Math.floor(String(it.title).length / 15));
  if (it.yearBuilt != null || it.detail?.yearBuilt != null) s += 2;
  if (it.detail?.builtText) s += 2;
  if (it.structure || it.detail?.structure) s += 2;
  if (it.storeys != null) s += 1;
  if (it.detail?.zoning) s += 1;
  if (it.detail?.landRight) s += 1;
  if (it.detail?.cityPlan) s += 1;
  if (it.googleMapsUrl) s += 1;
  if (it.lat != null && it.lon != null) s += 1;
  // soft preference for longer free-text blobs if present later
  const desc = it.description || it.detail?.description;
  if (desc) s += Math.min(8, Math.floor(String(desc).length / 80));
  return s;
}

function normBanchiAddress(addr) {
  if (!addr) return null;
  let a = String(addr)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s|　/g, "")
    .replace(/東京都/, "");
  // require some numeric token so bare 〇〇丁目 does not collapse a whole block
  if (!/\d/.test(a)) return null;
  a = a
    .replace(/丁目/g, "-")
    .replace(/番地名?/g, "")
    .replace(/番/g, "-")
    .replace(/号/g, "")
    .replace(/-+/g, "-")
    .replace(/-$/g, "");
  return a;
}

function areasMatch(a, b) {
  const aa = buildingAreaM2(a);
  const bb = buildingAreaM2(b);
  if (aa == null || bb == null) return null;
  return Math.abs(aa - bb) <= AREA_EPS_M2;
}

function pricesClose(a, b) {
  const pa = priceManYen(a);
  const pb = priceManYen(b);
  if (pa == null || pb == null) return null;
  if (pa === pb) return true;
  const mid = (pa + pb) / 2;
  return mid > 0 && Math.abs(pa - pb) / mid <= PRICE_EPS_RATIO;
}

export function isSameProperty(a, b) {
  if (!a || !b || a.id === b.id) return false;

  const hasCoords = a.lat != null && a.lon != null && b.lat != null && b.lon != null;
  const area = areasMatch(a, b);
  const price = pricesClose(a, b);

  if (hasCoords) {
    const dist = haversineM(a.lat, a.lon, b.lat, b.lon);
    // Strong: close pins + same building footprint
    if (dist <= MAX_DISTANCE_M && area === true) return true;
    // Fallback: very close + same price + same layout when area missing
    if (
      dist <= TIGHT_DISTANCE_M &&
      area !== false &&
      price === true &&
      a.madori &&
      b.madori &&
      a.madori === b.madori
    ) {
      return true;
    }
    return false;
  }

  const aa = normBanchiAddress(a.address || a.detail?.address);
  const bb = normBanchiAddress(b.address || b.detail?.address);
  if (aa && bb && aa === bb && area === true && price !== false) return true;

  return false;
}

function prefer(a, b) {
  const sa = richnessScore(a);
  const sb = richnessScore(b);
  if (sa !== sb) return sa >= sb ? a : b;
  // tie-break: more precise address, then stable id
  const pa = addressPrecisionScore(a.address || a.detail?.address);
  const pb = addressPrecisionScore(b.address || b.detail?.address);
  if (pa !== pb) return pa >= pb ? a : b;
  return String(a.id) <= String(b.id) ? a : b;
}

/**
 * @param {object[]} listings
 * @returns {{ listings: object[], removed: object[], clusters: number }}
 */
export function dedupeListings(listings) {
  const items = [...(listings || [])];
  const n = items.length;
  if (n <= 1) return { listings: items, removed: [], clusters: 0 };

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i, j) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isSameProperty(items[i], items[j])) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const kept = [];
  const removed = [];
  let clusters = 0;

  for (const idxs of groups.values()) {
    if (idxs.length === 1) {
      kept.push(items[idxs[0]]);
      continue;
    }
    clusters += 1;
    let winner = items[idxs[0]];
    for (let k = 1; k < idxs.length; k++) winner = prefer(winner, items[idxs[k]]);
    kept.push({
      ...winner,
      dedupedFrom: idxs.map((i) => items[i].id).filter((id) => id !== winner.id),
    });
    for (const i of idxs) {
      if (items[i].id === winner.id) continue;
      removed.push({
        id: items[i].id,
        url: items[i].url,
        keptId: winner.id,
        reason: "same_property_less_detail",
        richness: richnessScore(items[i]),
        keptRichness: richnessScore(winner),
      });
    }
  }

  // stable-ish sort by price then id
  kept.sort((a, b) => (priceManYen(a) ?? 1e12) - (priceManYen(b) ?? 1e12) || String(a.id).localeCompare(String(b.id)));

  return { listings: kept, removed, clusters };
}
