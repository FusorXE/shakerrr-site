import test from "node:test";
import assert from "node:assert/strict";
import { publishedNote } from "../src/content.js";

test("reject obvious imported extraction/provenance failures", () => {
  for (const text of [
    "(apologies as | cannot recall where | picked this up!)",
    "Sorry, I can't extract the text from this image.",
    "As an AI, I cannot view the uploaded page.",
    "[OCR failed]",
    "eparting slightly from the facts of history in + the name of heightening romantic tension",
  ]) assert.equal(publishedNote(text), "");
});

test("keep drink facts and limit OCR correction to known mistakes", () => {
  assert.equal(publishedNote("A sour with lime, mezcal and agave."), "A sour with lime, mezcal and agave.");
  assert.equal(publishedNote("I’m sorry to see this drink disappear from menus."), "I’m sorry to see this drink disappear from menus.");
  assert.equal(publishedNote("Wait a minute—|’ve got it!"), "Wait a minute—I’ve got it!");
  assert.equal(publishedNote("A complete source sentence. Bourbon became the preferred spirit only aft"), "A complete source sentence.");
  assert.equal(publishedNote(null), "");
});
