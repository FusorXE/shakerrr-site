import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizedDrinkName, exactCocktailDbMatch, exactCommonsMatch, exactWikipediaMatch,
  resolveOnlinePhoto, resetOnlinePhotoCache,
} from "../src/remote-photos.js";

test("cocktail names match regardless of accents and punctuation", () => {
  assert.equal(normalizedDrinkName("Donn’s Demon"), "donn s demon");
  assert.equal(normalizedDrinkName("Absinthe Frappé"), "absinthe frappe");
});

test("CocktailDB image must be exact cocktail, not a partial search match", () => {
  const drinks = [
    { strDrink: "Margarita Sunrise", strDrinkThumb: "https://example.com/wrong.jpg", idDrink: "1" },
    { strDrink: "Margarita", strDrinkThumb: "https://example.com/right.jpg", idDrink: "2" },
  ];
  assert.equal(exactCocktailDbMatch("Margarita", drinks).path, "https://example.com/right.jpg");
  assert.equal(exactCocktailDbMatch("Negroni", drinks), null);
});

test("Commons does not confuse a city with the Manhattan cocktail", () => {
  const pages = {
    1: { title: "File:Manhattan skyline.jpg", imageinfo: [{ width: 3200, height: 2000, mime: "image/jpeg", url: "https://example.com/city.jpg" }] },
    2: { title: "File:Manhattan cocktail.jpg", imageinfo: [{ width: 2800, height: 2000, mime: "image/jpeg", url: "https://example.com/drink.jpg" }] },
  };
  assert.equal(exactCommonsMatch("Manhattan", pages).path, "https://example.com/drink.jpg");
  assert.equal(exactCommonsMatch("Sidecar", pages), null);
});

test("Wikipedia match requires a cocktail article, not a person or city", () => {
  const pages = {
    1: { pageid: 10, title: "Aviation", extract: "Aviation is the process of operating aircraft.",
      thumbnail: { source: "https://upload.wikimedia.org/aviation.jpg" } },
    2: { pageid: 20, title: "Aviation (cocktail)", extract: "The Aviation is a classic cocktail made from gin.",
      thumbnail: { source: "https://upload.wikimedia.org/cocktail.jpg" } },
  };
  assert.equal(exactWikipediaMatch("Aviation", pages).path,
    "https://upload.wikimedia.org/cocktail.jpg");
});

test("remote cocktail lookup returns an online URL and never downloads a file", async () => {
  const originalFetch = globalThis.fetch;
  const called = [];
  try {
    globalThis.fetch = async (url) => {
      called.push(String(url));
      return { ok: true, json: async () => ({ drinks: [{
        strDrink: "Cuba Libre", strDrinkThumb: "https://www.thecocktaildb.com/images/media/drink/cubalibre.jpg", idDrink: "13270",
      }] }) };
    };
    resetOnlinePhotoCache();
    const match = await resolveOnlinePhoto({ name: "Cuba Libre" });
    assert.equal(match.source, "TheCocktailDB");
    assert.ok(match.path.startsWith("https://"));
    assert.equal(called.length, 1);
    const second = await resolveOnlinePhoto("Cuba Libre");
    assert.equal(second.path, match.path);
    assert.equal(called.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetOnlinePhotoCache();
  }
});
