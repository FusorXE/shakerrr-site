import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
const read = (name) => JSON.parse(fs.readFileSync(new URL("../data/" + name, import.meta.url), "utf8"));
const photos = read("publisher-photos.json").byRecipe;
const versions = read("source-versions.json").byRecipe;
const atlas = read("atlas-recipes.json").recipes;
const sourceRecipes = read("recipes.json");

test("missing PUNCH and Death & Co photos point to corresponding actual recipe pages", () => {
  for (const id of ["capitan", "blazing-saddles", "flor-de-jalisco", "prima-china", "pink-elephant"]) {
    const choice = photos[id]?.candidates?.[0];
    assert.ok(choice, "Missing image: " + id);
    assert.equal(choice.available, true);
    assert.match(choice.path, /^https:\/\//);
    assert.match(choice.sourceUrl, /^https:\/\//);
  }
  assert.equal(photos.capitan.candidates[0].sourceUrl, "https://punchdrink.com/recipes/capitan/");
  assert.match(photos["blazing-saddles"].candidates[0].sourceUrl, /blazing-saddles-death-co-recipe/);
  for (const id of ["mexican-firing-squad", "de-la-louisiane", "milano-torino", "philadelphia-fish-house-punch"]) {
    assert.equal(photos[id].candidates[0].source, "PUNCH");
  }
});

test("recipe source tabs add true alternatives without replacing the book or personal recipes", () => {
  assert.ok(sourceRecipes.find(r => r.id === "blazing-saddles").versions.some(v => v.label === "Death & Co"));
  assert.ok(versions["blazing-saddles"].some(v => v.label.includes("adaptation")));
  assert.ok(versions.capitan.some(v => v.label.includes("PUNCH")));
  assert.ok(versions.capitan.some(v => v.label.includes("Difford")));
  assert.ok(versions.bicicletta.some(v => v.label === "PUNCH"));
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /version-tabs.*role=/);
  assert.match(source, /MJ Personal Version/);
  assert.match(source, /Story & history/);
});

test("Atlas additions are sourced, usable and cannot mutate canonical catalog", () => {
  assert.equal(atlas.length, 5);
  assert.deepEqual(new Set(atlas.map(r => r.country)), new Set(["Finland", "Russia", "Turkey", "Greece", "China"]));
  const canonical = new Set(sourceRecipes.map(r => r.id));
  for (const recipe of atlas) {
    assert.ok(!canonical.has(recipe.id), "Atlas-only recipe accidentally duplicates a canonical id");
    assert.ok(recipe.versions?.length > 0);
    assert.ok(recipe.versions[0].ingredients?.length > 0);
    assert.match(recipe.versions[0].url, /^https:\/\//);
    assert.ok(recipe.geographyNote?.length > 12);
    assert.ok(photos[recipe.id]?.candidates?.[0]?.sourceUrl);
  }
  assert.match(atlas.find(r => r.country === "China").geographyNote, /not.*originated/i);
});

test("PUNCH image indexer only fills absent photo records", () => {
  const indexer = fs.readFileSync(new URL("../scripts/index-publisher-photos.mjs", import.meta.url), "utf8");
  assert.match(indexer, /async function punch\(recipe\)/);
  assert.match(indexer, /if \(!byRecipe\[recipe.id\]\?\.candidates\?\.length\)/);
});
