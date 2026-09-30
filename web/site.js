/** Shared helpers for static hosting (local serve + GitHub Pages). */

export const TYPES = [
  { type: "kodate", label: "一戸建て", labelEn: "Detached house", deal: "buy" },
  { type: "mansion", label: "マンション", labelEn: "Apartment", deal: "buy" },
  { type: "tochi", label: "土地", labelEn: "Land", deal: "buy" },
  { type: "kodate_rent", label: "一戸建て", labelEn: "Detached house", deal: "rent" },
  { type: "mansion_rent", label: "マンション", labelEn: "Apartment", deal: "rent" },
];

export const LABELS = {
  kodate: "Detached house",
  mansion: "Apartment",
  tochi: "Land",
  kodate_rent: "Detached house",
  mansion_rent: "Apartment",
};

/** Resolve output JSON/GeoJSON URL relative to the current page (works under / and /web/). */
export function outputUrl(file) {
  const name = file.endsWith(".json") || file.endsWith(".geojson") ? file : `${file}.json`;
  return new URL(`../output/${encodeURIComponent(name)}`, location.href).href;
}

/**
 * Criteria bullets from a result file's `filters` object.
 * Only budget, walk time, exclusive area, and age — never stations/ku.
 */
export function formatCriteria(filters, { deal } = {}) {
  if (!filters || typeof filters !== "object") return [];

  const parts = [];
  const kind = deal || filters.deal || "buy";

  if (filters.priceMaxManYen != null) {
    parts.push(
      kind === "rent"
        ? `Budget ≤${filters.priceMaxManYen}万円/月`
        : `Budget ≤${filters.priceMaxManYen}万円`
    );
  }

  if (filters.walkMinutesMax != null) {
    parts.push(`Walk ≤${filters.walkMinutesMax} min`);
  }

  if (filters.exclusiveAreaMinM2 != null) {
    parts.push(`Exclusive area ≥${filters.exclusiveAreaMinM2}m²`);
  }

  if (filters.houseAgeYearsMax != null) {
    parts.push(`Age ≤${filters.houseAgeYearsMax}y`);
  }

  return parts;
}
