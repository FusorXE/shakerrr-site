import fs from "node:fs";
import { normalizeCatalog } from "../src/catalog-model.js";

const raw = JSON.parse(fs.readFileSync("data/recipes.json", "utf8"));
const catalog = normalizeCatalog(raw);
const web = JSON.parse(fs.readFileSync("data/web-photos.json", "utf8"));
const all = Object.entries(web.byRecipe || {});
const live = new Set(catalog.recipes.map((r) => r.id));
const photoIds = new Set(all.map(([id]) => id));
const active = all.filter(([id]) => live.has(id));
const unused = all.filter(([id]) => !live.has(id)).map(([id, item]) => ({
  imageId: id,
  name: item.candidates?.[0]?.sourceTitle || null,
  potentialMatches: catalog.recipes
    .filter((r) => r.id.includes(id.split("-")[0]) || r.name.toLowerCase().includes(id.split("-")[0]))
    .slice(0, 12)
    .map((r) => ({ id: r.id, name: r.name })),
}));
const local = active.filter(([, item]) => item.candidates?.some((p) => p.available && p.path?.startsWith("assets/recipes/web/")));
const report = {
  catalogCount: catalog.recipes.length,
  totalWebPhotoRecords: all.length,
  activePhotoCards: active.length,
  activeLocalWebP: local.length,
  unmatchedPhotoRecords: unused,
  missingWebPhotoCards: catalog.recipes.filter((r) => !photoIds.has(r.id)).map(({ id, name }) => ({ id, name })),
};
fs.writeFileSync("data/web-photo-coverage.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  total: report.catalogCount,
  activePhotoCards: report.activePhotoCards,
  activeLocalWebP: report.activeLocalWebP,
  unmatched: unused.map((x) => x.imageId),
}, null, 2));
