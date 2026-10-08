import test from "node:test";
import assert from "node:assert/strict";
import { photoCandidates, photoCredit } from "../src/photos.js";
const regular = {
  available: true,
  path: "regular.webp",
  source: "Book",
  status: "exact-book",
};
const movie = {
  available: true,
  path: "movie.webp",
  source: "Hollywood Cocktails",
  status: "exact-book",
  book: "05",
};
test("default follows canonical photo, versions follow their own photo, movies require an exact book match", () => {
  const recipe = { image: "regular.webp" },
    entry = { candidates: [movie, regular] };
  assert.equal(photoCandidates(recipe, entry)[0], regular);
  assert.equal(
    photoCandidates(recipe, entry, { version: { image: "movie.webp" } })[0],
    movie,
  );
  assert.deepEqual(photoCandidates(recipe, entry, { movie: true }), [movie]);
  assert.deepEqual(
    photoCandidates(recipe, { candidates: [regular] }, { movie: true }),
    [],
  );
});
test("provenance distinguishes book cocktail photos from film stills and representative photos", () => {
  assert.match(photoCredit(movie), /scene image unavailable/);
  assert.match(
    photoCredit({ ...regular, sharedVisualFrom: "margarita" }),
    /Representative photo: margarita/,
  );
});
