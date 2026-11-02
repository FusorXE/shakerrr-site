// Load cocktail photography directly from online providers. No download, WebP
// conversion, repository commits or image-search keys are required.
const photoCache = new Map();
const waiting = [];
let running = 0;
const MAX_PARALLEL_LOOKUPS = 3;

export function normalizedDrinkName(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

export function exactCocktailDbMatch(name, drinks) {
  if (!Array.isArray(drinks)) return null;
  const wanted = normalizedDrinkName(name);
  if (!wanted) return null;
  const item = drinks.find((drink) =>
    normalizedDrinkName(drink.strDrink) === wanted &&
    /^https:\/\//.test(drink.strDrinkThumb || ""));
  return item?.strDrinkThumb ? {
    path: item.strDrinkThumb,
    source: "TheCocktailDB",
    sourceUrl: "https://www.thecocktaildb.com/drink/" + encodeURIComponent(item.idDrink),
    status: "online-match",
    available: true,
  } : null;
}

export function exactCommonsMatch(name, pages) {
  const wanted = normalizedDrinkName(name);
  if (!wanted || !pages) return null;
  const terms = wanted.split(" ").filter((word) => word.length > 1);
  const matches = Object.values(pages).flatMap((page) => {
    const title = String(page.title || "").replace(/^File:/i, "");
    const cleanTitle = normalizedDrinkName(title.replace(/\.(jpg|jpeg|png|webp)$/i, ""));
    const ii = page.imageinfo?.[0];
    if (!ii || ii.width < 900 || ii.height < 900 || !/^image\//.test(ii.mime || "")) return [];
    if (!terms.every((term) => cleanTitle.split(" ").includes(term))) return [];
    // "Manhattan", "Sidecar", "Aviation" etc also describe non-drink subjects.
    if (!/\b(cocktail|drink|mixed beverage|in a glass)\b/i.test(title)) return [];
    const path = ii.thumburl || ii.url;
    if (!/^https:\/\//.test(path || "")) return [];
    const sourceUrl = ii.descriptionurl || "https://commons.wikimedia.org/";
    return [{
      path, originalUrl: ii.url, source: "Wikimedia Commons",
      sourceUrl, status: "online-match", available: true,
      matchScore: cleanTitle === wanted + " cocktail" ? 2 : 1,
    }];
  });
  matches.sort((x, y) => y.matchScore - x.matchScore);
  return matches[0] || null;
}

export function exactWikipediaMatch(name, pages) {
  const wanted = normalizedDrinkName(name);
  if (!wanted || !pages) return null;
  for (const page of Object.values(pages)) {
    const title = normalizedDrinkName(page.title || "");
    if (title !== wanted && title !== wanted + " cocktail") continue;
    if (!/\b(cocktail|mixed drink|alcoholic drink|alcoholic beverage)\b/i.test(page.extract || "")) continue;
    const source = page.thumbnail?.source || page.original?.source;
    if (!/^https:\/\//.test(source || "")) continue;
    return {
      path: source, source: "Wikipedia",
      sourceUrl: "https://en.wikipedia.org/?curid=" + encodeURIComponent(page.pageid),
      available: true, status: "online-match",
    };
  }
  return null;
}

function queueLookup(work) {
  return new Promise((resolve) => {
    waiting.push({ work, resolve });
    drain();
  });
}

function drain() {
  while (running < MAX_PARALLEL_LOOKUPS && waiting.length) {
    const item = waiting.shift();
    running++;
    Promise.resolve().then(item.work).then(item.resolve, () => item.resolve(null))
      .finally(() => { running--; drain(); });
  }
}

async function jsonFrom(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error("Image API HTTP " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchOnline(name) {
  const db = "https://www.thecocktaildb.com/api/json/v1/1/search.php?s=" + encodeURIComponent(name);
  try {
    const result = exactCocktailDbMatch(name, (await jsonFrom(db)).drinks);
    if (result) return result;
  } catch { /* Try Commons instead. */ }

  const wikiParams = new URLSearchParams({
    action: "query", titles: name + " (cocktail)|" + name,
    prop: "pageimages|extracts", piprop: "thumbnail|original",
    pithumbsize: "1200", exintro: "1", explaintext: "1",
    redirects: "1", format: "json", origin: "*",
  });
  try {
    const match = exactWikipediaMatch(name,
      (await jsonFrom("https://en.wikipedia.org/w/api.php?" + wikiParams)).query?.pages);
    if (match) return match;
  } catch { /* Try Commons instead. */ }

  const params = new URLSearchParams({
    action: "query", generator: "search",
    gsrsearch: '"' + name.replace(/"/g, "") + '" cocktail',
    gsrnamespace: "6", gsrlimit: "6",
    prop: "imageinfo", iiprop: "url|size|mime",
    iiurlwidth: "1200", format: "json", origin: "*",
  });
  try {
    return exactCommonsMatch(name,
      (await jsonFrom("https://commons.wikimedia.org/w/api.php?" + params)).query?.pages);
  } catch {
    return null;
  }
}

/** Resolve only once per drink per browsing session, even across multiple cards. */
export function resolveOnlinePhoto(recipe) {
  const name = typeof recipe === "string" ? recipe : recipe?.name || "";
  const key = normalizedDrinkName(name);
  if (!key) return Promise.resolve(null);
  if (!photoCache.has(key)) photoCache.set(key, queueLookup(() => searchOnline(name)));
  return photoCache.get(key);
}

export function resetOnlinePhotoCache() {
  photoCache.clear();
}
