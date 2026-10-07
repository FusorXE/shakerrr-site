import {
  normalizeCatalog,
  normalizeImageManifest,
  migrateLocalStorage,
} from "./catalog-model.js";

const nativeFetch = window.fetch.bind(window);

async function jsonFrom(url) {
  const response = await nativeFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
  return response.json();
}

const catalogPromise = jsonFrom("data/recipes.json").then((raw) => {
  const catalog = normalizeCatalog(raw);
  migrateLocalStorage(window.localStorage, catalog.aliasToCard);
  window.__SHAKERRR_CATALOG__ = catalog;
  console.info("Shakerrr canonical catalog", catalog.stats);
  return catalog;
});

const manifestPromise = Promise.all([
  catalogPromise,
  jsonFrom("data/image-manifest.json"),
]).then(([catalog, manifest]) => {
  const normalized = normalizeImageManifest(manifest, catalog);
  window.__SHAKERRR_IMAGE_COVERAGE__ = normalized.canonicalCardCoverage;
  console.info("Shakerrr canonical image coverage", normalized.canonicalCardCoverage);
  return normalized;
});

function pathOf(input) {
  try {
    const raw = typeof input === "string" ? input : input?.url;
    return new URL(raw, window.location.href).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

window.fetch = async function shakerrrCanonicalFetch(input, init) {
  const path = pathOf(input);
  if (path.endsWith("/data/recipes.json")) {
    const catalog = await catalogPromise;
    return jsonResponse(catalog.recipes);
  }
  if (path.endsWith("/data/image-manifest.json")) {
    return jsonResponse(await manifestPromise);
  }
  return nativeFetch(input, init);
};
