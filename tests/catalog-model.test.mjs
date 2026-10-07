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
const sourceIds = new Set(recipes.map((r) => r.id));

function assertGrouped(cardId, members) {
  const card = byId.get(cardId);
  assert.ok(card, `${cardId} canonical card is required`);
  for (const id of members) {
    if (!sourceIds.has(id)) continue;
    assert.equal(catalog.aliasToCard[id], cardId, `${id} must resolve to ${cardId}`);
    assert.ok(card.sourceRecipeIds.includes(id), `${cardId} must retain source recipe ${id}`);
  }
}

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

test("classic families consolidate source/spec variants into one card", () => {
  assertGrouped("manhattan", ["manhattan-classic", "manhattan-dry", "manhattan-perfect", "simple-manhattan", "black-market-manhattan"]);
  assertGrouped("martini", ["fitty-fitty-martini", "gibson", "mezcal-martini"]);
  assertGrouped("margarita", [
    "all-purpose-margarita", "margarita-classic", "margarita-bitter-orange", "margarita-cadillac",
    "margarita-frozen", "margarita-hibiscus", "margarita-smoky-chili", "margarita-spritz-strawberry",
    "margarita-tamarind", "tommys-margarita", "simple-mezcal-margarita", "mezcal-rita", "mezcalrita",
    "kiwi-margarita", "elote-margarita", "mangito-sonidero-margarita", "pina-margarita",
    "rosemary-cranberry-holiday-margarita", "smoky-ginger-margarita",
  ]);
  assertGrouped("daiquiri", ["daiquiri-classic", "daiquiri-mulata", "daiquiri-strawberry", "frozen-strawberry-daiquiri", "derby-daiquiri", "frozen-derby-daiquiri", "floridita-daiquiri", "hemingway-daiquiri"]);
  assertGrouped("mojito", ["mojito-classic", "mojito-basic", "mojito-a-mi-manera", "mojito-tequila"]);
  assertGrouped("negroni", ["beachcomber-negroni", "frozen-negroni", "mezcal-negroni", "negroni-sbagliato", "negroni-sour", "negroni-tequila", "white-negroni", "white-negroni-sbagliato"]);
  assertGrouped("old-fashioned", ["oaxaca-old-fashioned", "oaxacan-old-fashioned"]);
  assertGrouped("french-75", ["original-french-75", "french-95"]);
});

test("additional classic families consolidate without losing source identity", () => {
  assertGrouped("bloody-mary", ["bloody-maria", "mezcal-bloody-mary"]);
  assertGrouped("paloma", ["earl-grey-paloma", "mezcal-paloma", "spicy-paloma"]);
  assertGrouped("moscow-mule", ["mezcal-mule"]);
  assertGrouped("cosmopolitan", ["classic-cosmopolitan"]);
  assertGrouped("planters-punch", ["planters-punch-rum"]);
  assertGrouped("zombie", ["zombie-punch"]);
});

test("grouping is meaningful rather than a token five-record collapse", () => {
  assert.ok(catalog.stats.collapsedRecordCount >= 25, `expected substantial consolidation, got ${catalog.stats.collapsedRecordCount}`);
  assert.ok(catalog.stats.canonicalCardCount <= recipes.length - 25);
});

test("named classic variants remain explicit version tabs with their own source provenance", () => {
  for (const [cardId, sourceId] of [
    ["manhattan", "simple-manhattan"],
    ["martini", "gibson"],
    ["margarita", "margarita-hibiscus"],
    ["negroni", "white-negroni"],
    ["daiquiri", "hemingway-daiquiri"],
  ]) {
    if (!sourceIds.has(sourceId)) continue;
    const versions = byId.get(cardId)?.versions || [];
    assert.ok(versions.some((v) => v.sourceRecipeId === sourceId), `${sourceId} needs its own version tab on ${cardId}`);
  }
});

test("materially different espresso-style Martini drinks stay separate", () => {
  for (const id of ["espresso-martini", "espresso-mezcaltini"]) {
    if (!sourceIds.has(id)) continue;
    assert.equal(catalog.aliasToCard[id], id, `${id} should not collapse into Martini`);
  }
});

test("known Martini extraction contamination is kept out of production tabs", () => {
  const rawMartini = recipes.find((r) => r.id === "martini");
  if (!rawMartini) return;
  const contaminated = (rawMartini.versions || []).some((v) =>
    v.label === "Essential Cocktails 2021" && String(v.note || "").toLowerCase().includes("daiquiri mulata"),
  );
  if (!contaminated) return;
  const martini = byId.get("martini");
  assert.ok(martini);
  assert.equal((martini.versions || []).some((v) =>
    v.sourceRecipeId === "martini" && v.label === "Essential Cocktails 2021" && String(v.note || "").toLowerCase().includes("daiquiri mulata"),
  ), false);
});

test("Tropical Standard, Death & Co and Hollywood variants survive as version provenance", () => {
  const probes = [
    ["negroni", "frozen-negroni", "Tropical Standard"],
    ["martini", "fitty-fitty-martini", "Death & Co"],
    ["manhattan", "simple-manhattan", "Cocktails from Movies"],
  ];
  for (const [cardId, sourceId, collection] of probes) {
    if (!sourceIds.has(sourceId)) continue;
    const card = byId.get(cardId);
    assert.ok(card?.sourceRecipeIds.includes(sourceId));
    const raw = recipes.find((r) => r.id === sourceId);
    if ((raw?.collections || []).includes(collection)) {
      assert.ok((card.versions || []).some((v) => v.sourceRecipeId === sourceId && (v.collections || []).includes(collection)));
    }
  }
});

test("separate visual fallbacks remain linked instead of being collapsed", () => {
  for (const [id, parent] of Object.entries(VISUAL_FALLBACKS)) {
    if (!byId.has(id) || !byId.has(parent)) continue;
    assert.equal(catalog.aliasToCard[id], id);
    assert.equal(byId.get(id).visualFallbackId, parent);
    assert.ok((byId.get(id).related || []).includes(parent));
    assert.ok((byId.get(parent).related || []).includes(id));
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
