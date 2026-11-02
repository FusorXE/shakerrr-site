import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedNote } from "../src/content.js";
import { mezcalIllustrativePhoto } from "../src/mezcal-fallback.js";

test("historically truncated imported book notes end at a complete sentence", () => {
  const truncated = "The cocktail began in 1920. Its unusual ingredients became more popular in local bars. ".padEnd(650, "x");
  const excerpt = publishedNote(truncated);
  assert.match(excerpt, /bars\.$/);
  assert.equal(excerpt.includes("xxxx"), false);
  assert.equal(publishedNote("My personal note can have no period"), "My personal note can have no period");
});

test("mezcal image fallback is explicit, attributed and never used for non-mezcal", () => {
  const photo = mezcalIllustrativePhoto({ name: "Cilantro Bravo", category: "Mezcal", ingredients: [] });
  assert.match(photo.url, /^https:\/\/images\.pexels\.com\//);
  assert.match(photo.credit, /not this exact recipe/);
  assert.match(photo.sourceUrl, /^https:\/\/www\.pexels\.com\/photo\//);
  assert.equal(mezcalIllustrativePhoto({ name: "Martini", category: "Classic", ingredients: [{ name: "Gin" }] }), null);
});

test("source picker preserves desktop tabs and has mobile-native selection", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /id="versionSelect"/);
  assert.match(app, /class="version-tab"/);
  assert.match(app, /sourcePicker\.value = String\(i\)/);
  assert.match(css, /\.detail-copy \.version-tab \{[\s\S]*flex: 0 0 auto/);
  assert.match(css, /\.detail-copy \.version-picker select/);
  assert.match(app, /mezcalIllustrativePhoto\(r\)/);
  assert.match(app, /if \(!lookedOnline\) \{/);
});
