import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { ingredientOverlay } from "../src/ingredient-overlay.js";

test("ingredient callouts reflect selected version and escape text", () => {
  const markup = ingredientOverlay([
    { amount: "1 oz", name: "vodka" },
    { amount: "1 oz", name: "espresso" },
    { amount: "½ oz", name: "Kahlúa" },
    { amount: "½ oz", name: "simple syrup" },
    { amount: "2 drops", name: "<unsafe>" },
  ], (value) => value);
  assert.match(markup, /espresso/);
  assert.match(markup, /ingredient-overlay-grid/);
  assert.equal((markup.match(/ingredient-overlay-item/g) || []).length, 4);
  assert.doesNotMatch(markup, /<unsafe>/);
  assert.equal(ingredientOverlay([]), "");
});

test("new web catalog contains only reviewed Pexels website photos", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../data/web-photos.json", import.meta.url), "utf8"));
  assert.ok(Object.keys(manifest.byRecipe).length > 0);
  for (const [id, record] of Object.entries(manifest.byRecipe)) {
    assert.match(id, /^[a-z0-9-]+$/);
    for (const photo of record.candidates) {
      assert.equal(photo.status, "web-curated");
      assert.equal(photo.available, true);
      assert.equal(photo.license, "Pexels License");
      assert.equal(new URL(photo.sourceUrl).hostname, "www.pexels.com");
      assert.equal(new URL(photo.originalUrl).hostname, "images.pexels.com");
      assert.ok(photo.path.startsWith("assets/recipes/web/") || new URL(photo.path).hostname === "images.pexels.com");
      assert.ok(photo.source);
    }
  }
});
