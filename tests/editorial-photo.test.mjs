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

test("web catalog only contains reviewed and licensed website photographs", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../data/web-photos.json", import.meta.url), "utf8"));
  assert.ok(Object.keys(manifest.byRecipe).length > 0);
  for (const [id, record] of Object.entries(manifest.byRecipe)) {
    assert.match(id, /^[a-z0-9-]+$/);
    for (const photo of record.candidates) {
      assert.equal(photo.status, "web-curated");
      assert.equal(photo.available, true);
      assert.ok(photo.license === "Pexels License" || photo.license === "CC0" || /^CC BY(?:-SA)? [234]\.0$/.test(photo.license));
      assert.ok(["www.pexels.com","commons.wikimedia.org"].includes(new URL(photo.sourceUrl).hostname));
      assert.ok(["images.pexels.com","upload.wikimedia.org","thumb.wikimedia.org"].includes(new URL(photo.originalUrl).hostname));
      assert.ok(photo.path.startsWith("assets/recipes/web/") || ["images.pexels.com","upload.wikimedia.org","thumb.wikimedia.org"].includes(new URL(photo.path).hostname));
      if (photo.license !== "Pexels License") {
        assert.ok(photo.license === "CC0" ? photo.licenseUrl.startsWith("https://creativecommons.org/publicdomain/zero/") : photo.licenseUrl.startsWith("https://creativecommons.org/licenses/"));
        assert.ok(photo.artist);
        assert.ok(photo.modified);
      }
      assert.ok(photo.source);
    }
  }
});

test("app uses valid DOM collection selectors without malformed triple-dollar calls", () => {
  const code = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(code, /\$\$\$\(/);
  assert.doesNotMatch(code, /(?<!\$)\$\([^\n)]*\)\.forEach\(/);
  assert.match(code, /\$\$\("\.version-tab"\)\.forEach\(/);
});
