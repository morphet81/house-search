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
