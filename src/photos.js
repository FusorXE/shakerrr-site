export function isMoviePhoto(candidate) {
  return (
    candidate.status === "exact-book" &&
    !candidate.sharedVisualFrom &&
    (candidate.book === "05" ||
      /Hollywood Cocktails|Cocktails from Movies/i.test(candidate.source || ""))
  );
}

export function photoCandidates(
  recipe,
  entry,
  { version, movie = false } = {},
) {
  const available = (entry?.candidates || []).filter(
    (c) => c.available && c.path,
  );
  const candidates = movie ? available.filter(isMoviePhoto) : available;
  const preferred = version?.image || recipe.image;
  return [
    ...candidates.filter((c) => c.path === preferred),
    ...candidates.filter((c) => c.path !== preferred),
  ].filter(
    (c, i, list) => list.findIndex((other) => other.path === c.path) === i,
  );
}

export function photoCredit(candidate) {
  const source = `${candidate.source}${candidate.page ? " · p. " + candidate.page : ""}`;
  if (candidate.sharedVisualFrom || candidate.status === "recipe-matched")
    return `${source} · Representative photo: ${candidate.sourceImageRecipe || candidate.sharedVisualFrom}`;
  return isMoviePhoto(candidate)
    ? `${source} · Book cocktail photo; scene image unavailable`
    : source;
}
