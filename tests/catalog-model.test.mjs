import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeCatalog,
  normalizeImageManifest,
  GROUP_RULES,
  VISUAL_FALLBACKS,
} from "../src/catalog-model.js";

const recipes = JSON.parse(await readFile(new URL("../data/recipes.json", import.meta.url), "utf8"));
const images = JSON.parse(await readFile(new URL("../data/image-manifest.json", import.meta.url), "utf8"));

const catalog = normalizeCatalog(recipes);
const manifest = normalizeImageManifest(images, catalog);

const byId = new Map(catalog.recipes.map((r) => [r.id, r]));

test("every source recipe survives as a canonical card member", () => {
  const ids = catalog.recipes.flatMap((r) => r.sourceRecipeIds || []);
  assert.equal(ids.length, recipes.length);
  assert.equal(new Set(ids).size, recipes.length);
  for (const r of recipes) assert.ok(catalog.aliasToCard[r.id], `missing alias for ${r.id}`);
});

test("canonical cards have unique ids and names", () => {
  assert.equal(new Set(catalog.recipes.map((r) => r.id)).size, catalog.recipes.length);
  const names = catalog.recipes.map((r) => r.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

test("Manhattan source/spec variants collapse to one card when present", () => {
  const sourceIds = new Set(recipes.map((r) => r.id));
  const manhattan = byId.get("manhattan");
  assert.ok(manhattan, "Manhattan card is required");
  for (const id of ["manhattan-dry", "manhattan-perfect", "simple-manhattan"]) {
    if (sourceIds.has(id)) assert.equal(catalog.aliasToCard[id], "manhattan");
  }
  assert.ok((manhattan.versions || []).length >= 2, "Manhattan must expose multiple source/version tabs");
});

test("visually distinct Margarita variants are not blindly collapsed", () => {
  for (const id of ["margarita-hibiscus", "margarita-frozen", "margarita-spritz-strawberry"]) {
    if (recipes.some((r) => r.id === id)) assert.equal(catalog.aliasToCard[id], id);
  }
});

test("named riffs may reuse a base visual without becoming the base cocktail", () => {
  for (const [id, parent] of Object.entries(VISUAL_FALLBACKS)) {
    if (!byId.has(id) || !byId.has(parent)) continue;
    assert.equal(catalog.aliasToCard[id], id);
    assert.equal(byId.get(id).visualFallbackId, parent);
  }
});

test("no fake reference-source tabs are created", () => {
  const sourceLabels = catalog.recipes.flatMap((r) => (r.versions || []).map((v) => v.label));
  for (const label of ["IBA", "Difford’s Guide", "Liquor.com"]) {
    const rawHadSource = recipes.some((r) => (r.versions || []).some((v) => String(v.label || "").startsWith(label)));
    const normalizedHasSource = sourceLabels.some((v) => String(v || "").startsWith(label));
    assert.equal(normalizedHasSource, rawHadSource, `${label} must only exist when verified source data exists`);
  }
});

test("canonical image coverage never becomes worse than card-level direct coverage", () => {
  const direct = catalog.recipes.filter((card) =>
    (card.sourceRecipeIds || [card.id]).some((id) =>
      (images.byRecipe?.[id]?.candidates || []).some((x) => x.available && x.path),
    ),
  ).length;
  assert.ok(manifest.canonicalCardCoverage.cardsWithImage >= direct);
  assert.equal(manifest.canonicalCardCoverage.totalCards, catalog.recipes.length);
});

test("group rules point at stable canonical identities", () => {
  for (const [id, rule] of Object.entries(GROUP_RULES)) {
    assert.ok(rule.cardId && rule.cardName, `invalid group rule ${id}`);
  }
});

console.log(JSON.stringify({
  rawRecipes: recipes.length,
  canonicalCards: catalog.stats.canonicalCardCount,
  sourceVersions: catalog.stats.sourceVersionCount,
  collapsedRecords: catalog.stats.collapsedRecordCount,
  cardsWithImage: manifest.canonicalCardCoverage.cardsWithImage,
  cardsMissingImage: manifest.canonicalCardCoverage.cardsMissingImage,
}, null, 2));
