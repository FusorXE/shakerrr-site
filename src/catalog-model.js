const clean = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const slug = (value = "") => clean(value).replace(/\s+/g, "-");

export const REFERENCE_SOURCES = [
  "Shakerrr House Spec",
  "IBA",
  "Difford’s Guide",
  "Liquor.com",
  "Death & Co",
  "Tropical Standard",
  "Essential Cocktail Book",
  "Essential Cocktails 2021",
  "Agave Companion",
  "Holy Smoke! It’s Mezcal!",
  "Liquid Intelligence",
  "Cocktails from Movies",
  "Creator Version",
  "MJ Personal Version",
];

// Only records that are the same cocktail identity are collapsed into one card.
// Named riffs remain separate cards unless explicitly listed here.
export const GROUP_RULES = {
  "manhattan-classic": { cardId: "manhattan", cardName: "Manhattan", variant: "Classic" },
  "manhattan-dry": { cardId: "manhattan", cardName: "Manhattan", variant: "Dry" },
  "manhattan-perfect": { cardId: "manhattan", cardName: "Manhattan", variant: "Perfect" },
  "simple-manhattan": { cardId: "manhattan", cardName: "Manhattan", variant: "Simple Manhattan" },
  "daiquiri-classic": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Classic" },
  "mojito-classic": { cardId: "mojito", cardName: "Mojito", variant: "Classic" },
  "mojito-basic": { cardId: "mojito", cardName: "Mojito", variant: "Basic" },
  "margarita-classic": { cardId: "margarita", cardName: "Margarita", variant: "Classic" },
  "margarita-cadillac": { cardId: "margarita", cardName: "Margarita", variant: "Cadillac" },
  "original-french-75": { cardId: "french-75", cardName: "French 75", variant: "Original" },
  "classic-cosmopolitan": { cardId: "cosmopolitan", cardName: "Cosmopolitan", variant: "Classic" },
  "planters-punch-rum": { cardId: "planters-punch", cardName: "Planter’s Punch", variant: "Rum" },
};

const GROUP_TARGETS = new Map();
for (const rule of Object.values(GROUP_RULES)) {
  if (!GROUP_TARGETS.has(rule.cardId)) GROUP_TARGETS.set(rule.cardId, rule);
}

// Separate named riffs can share the same photograph when the finished visual is
// effectively the same. A card with its own verified photograph always wins.
export const VISUAL_FALLBACKS = {
  "margarita-bitter-orange": "margarita",
  "margarita-smoky-chili": "margarita",
  "margarita-tamarind": "margarita",
  "simple-mezcal-margarita": "margarita",
  "mezcal-rita": "margarita",
  mezcalrita: "margarita",
  "tommys-margarita": "margarita",
  "negroni-tequila": "negroni",
  "oaxacan-old-fashioned": "old-fashioned",
  "oaxaca-old-fashioned": "old-fashioned",
  "mezcal-paloma": "paloma",
  "spicy-paloma": "paloma",
  "mezcal-bloody-mary": "bloody-mary",
  "mezcal-mule": "moscow-mule",
  "mezcal-martini": "martini",
  "mojito-tequila": "mojito",
  "french-95": "french-75",
};

const sourcePriority = [
  "Shakerrr House Spec",
  "IBA",
  "Difford’s Guide",
  "Liquor.com",
  "Essential Cocktail Book",
  "Death & Co",
  "Tropical Standard",
  "Essential Cocktails 2021",
  "Agave Companion",
  "Holy Smoke! It’s Mezcal!",
  "Liquid Intelligence",
  "Cocktails from Movies",
];

const unique = (values) => [...new Set(values.filter(Boolean))];

function versionFingerprint(v) {
  return JSON.stringify([
    clean(v.label),
    (v.ingredients || []).map((x) => [clean(x.name), String(x.amount || "").trim()]),
    clean(v.instructions),
    clean(v.garnish),
    clean(v.glass),
    clean(v.ice),
  ]);
}

function versionFromRecipe(recipe) {
  return {
    label: recipe.baseSource || recipe.collections?.[0] || "Published reference",
    type: "Published reference",
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || "",
    garnish: recipe.garnish || "",
    glass: recipe.glass || "",
    ice: recipe.ice || "",
    note: recipe.note || "",
    image: recipe.image || null,
    usable: true,
  };
}

function decorateVersion(version, recipe, rule) {
  const v = { ...version };
  const source = v.label || recipe.baseSource || recipe.collections?.[0] || "Published reference";
  const variant = rule?.variant || null;
  const movie = recipe.movie?.film ? `${recipe.movie.film}${recipe.movie.year ? ` (${recipe.movie.year})` : ""}` : null;
  const parts = [source];
  if (variant && !clean(source).includes(clean(variant))) parts.push(variant);
  if (movie && !clean(source).includes(clean(movie))) parts.push(movie);
  v.label = unique(parts).join(" · ");
  v.sourceRecipeId = recipe.id;
  v.sourceRecipeName = recipe.name;
  v.variant = variant || null;
  v.collections = recipe.collections || [];
  v.movie = recipe.movie || null;
  if (!v.image && recipe.image) v.image = recipe.image;
  return v;
}

function representativeScore(recipe, desiredId) {
  let score = 0;
  if (recipe.id === desiredId) score += 1000;
  if (slug(recipe.name) === desiredId) score += 400;
  if (recipe.image) score += 100;
  if (recipe.category === "Classic") score += 40;
  score += (recipe.versions || []).filter((v) => v.usable !== false).length * 5;
  return score;
}

function groupIdentity(recipe) {
  const rule = GROUP_RULES[recipe.id];
  if (rule) return { key: `explicit:${rule.cardId}`, cardId: rule.cardId, cardName: rule.cardName };
  const target = GROUP_TARGETS.get(recipe.id);
  if (target) return { key: `explicit:${recipe.id}`, cardId: recipe.id, cardName: target.cardName };
  return { key: `name:${clean(recipe.name)}`, cardId: null, cardName: recipe.name };
}

export function normalizeCatalog(rawRecipes = []) {
  const buckets = new Map();
  for (const recipe of rawRecipes) {
    const identity = groupIdentity(recipe);
    if (!buckets.has(identity.key)) buckets.set(identity.key, { identity, members: [] });
    buckets.get(identity.key).members.push(recipe);
  }

  const cards = [];
  const aliasToCard = {};
  const groupMeta = {};

  for (const bucket of buckets.values()) {
    const explicitId = bucket.identity.cardId;
    const desiredId = explicitId || bucket.members.find((r) => slug(r.name) === r.id)?.id || bucket.members[0].id;
    const members = [...bucket.members].sort((a, b) => representativeScore(b, desiredId) - representativeScore(a, desiredId));
    const primary = members[0];
    const cardId = desiredId;
    const cardName = bucket.identity.cardName || primary.name;
    const versions = [];
    const seenVersions = new Set();

    for (const recipe of members) {
      const rule = GROUP_RULES[recipe.id] || null;
      const sourceVersions = (recipe.versions || []).filter((v) => v.usable !== false);
      const usable = sourceVersions.length ? sourceVersions : [versionFromRecipe(recipe)];
      for (const rawVersion of usable) {
        const version = decorateVersion(rawVersion, recipe, rule);
        const fingerprint = versionFingerprint(version);
        if (seenVersions.has(fingerprint)) continue;
        seenVersions.add(fingerprint);
        versions.push(version);
      }
    }

    versions.sort((a, b) => {
      const ai = sourcePriority.indexOf(a.label?.split(" · ")[0]);
      const bi = sourcePriority.indexOf(b.label?.split(" · ")[0]);
      const ap = ai < 0 ? 999 : ai;
      const bp = bi < 0 ? 999 : bi;
      return ap - bp || String(a.label).localeCompare(String(b.label));
    });

    const allNames = unique(members.map((r) => r.name));
    const aliases = unique([
      ...(primary.aliases || []),
      ...members.flatMap((r) => r.aliases || []),
      ...allNames.filter((n) => clean(n) !== clean(cardName)),
    ]);
    const collections = unique(members.flatMap((r) => r.collections || []));
    const tags = unique(members.flatMap((r) => r.tags || []));
    const movie = members.map((r) => r.movie).find(Boolean) || null;
    const image = members.map((r) => r.image).find(Boolean) || null;
    const sourceRecipeIds = members.map((r) => r.id);

    const card = {
      ...primary,
      id: cardId,
      name: cardName,
      aliases,
      collections,
      tags,
      versions,
      image,
      movie,
      sourceRecipeIds,
      sourceRecipeNames: allNames,
      canonicalCard: true,
      visualFallbackId: VISUAL_FALLBACKS[cardId] || null,
    };
    const firstVersion = versions[0];
    if (firstVersion) {
      card.ingredients = firstVersion.ingredients || card.ingredients || [];
      card.instructions = firstVersion.instructions || card.instructions || "";
      card.garnish = firstVersion.garnish || card.garnish || "";
      card.glass = firstVersion.glass || card.glass || "";
      card.ice = firstVersion.ice || card.ice || "";
    }

    cards.push(card);
    groupMeta[cardId] = { sourceRecipeIds, sourceRecipeNames: allNames };
    for (const recipe of members) aliasToCard[recipe.id] = cardId;
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));

  const byId = new Map(cards.map((r) => [r.id, r]));
  for (const card of cards) {
    const parent = VISUAL_FALLBACKS[card.id];
    if (parent && byId.has(parent)) {
      card.parentId = parent;
      card.related = unique([...(card.related || []), parent]);
      const p = byId.get(parent);
      p.related = unique([...(p.related || []), card.id]);
    }
  }

  const sourceVersionCount = cards.reduce((n, r) => n + (r.versions || []).length, 0);
  return {
    recipes: cards,
    aliasToCard,
    groupMeta,
    stats: {
      rawRecipeCount: rawRecipes.length,
      canonicalCardCount: cards.length,
      sourceVersionCount,
      collapsedRecordCount: rawRecipes.length - cards.length,
    },
  };
}

function mergeCandidates(entries = []) {
  const out = [];
  const seen = new Set();
  for (const candidate of entries) {
    const key = [candidate.path, candidate.source, candidate.page, candidate.url].filter(Boolean).join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

export function normalizeImageManifest(manifest = {}, catalog) {
  const source = manifest.byRecipe || {};
  const byRecipe = {};
  for (const card of catalog.recipes) {
    const entries = [];
    for (const sourceRecipeId of card.sourceRecipeIds || [card.id]) {
      for (const candidate of source[sourceRecipeId]?.candidates || []) {
        entries.push({ ...candidate, sourceRecipeId });
      }
    }
    byRecipe[card.id] = {
      ...(source[card.id] || {}),
      candidates: mergeCandidates(entries),
    };
  }

  for (const card of catalog.recipes) {
    const current = byRecipe[card.id]?.candidates || [];
    if (current.some((x) => x.available && x.path)) continue;
    const fallbackId = card.visualFallbackId;
    if (!fallbackId || !byRecipe[fallbackId]) continue;
    const shared = (byRecipe[fallbackId].candidates || [])
      .filter((x) => x.available && x.path)
      .map((x) => ({ ...x, sharedVisualFrom: fallbackId }));
    if (shared.length) byRecipe[card.id] = { ...(byRecipe[card.id] || {}), candidates: shared };
  }

  const withImage = catalog.recipes.filter((card) =>
    (byRecipe[card.id]?.candidates || []).some((x) => x.available && x.path),
  ).length;
  return {
    ...manifest,
    byRecipe,
    canonicalCardCoverage: {
      totalCards: catalog.recipes.length,
      cardsWithImage: withImage,
      cardsMissingImage: catalog.recipes.length - withImage,
      sourceVersionCount: catalog.stats.sourceVersionCount,
    },
  };
}

export function migrateLocalStorage(storage, aliasToCard) {
  if (!storage || !aliasToCard) return;
  const parse = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key) || ""); } catch { return fallback; }
  };
  const favs = parse("shakerrr_favs", []);
  if (Array.isArray(favs)) storage.setItem("shakerrr_favs", JSON.stringify(unique(favs.map((id) => aliasToCard[id] || id))));

  const photoMode = parse("shakerrr_photo_mode", {});
  if (photoMode && typeof photoMode === "object" && !Array.isArray(photoMode)) {
    const next = { ...photoMode };
    for (const [id, mode] of Object.entries(photoMode)) {
      const target = aliasToCard[id];
      if (target && target !== id && next[target] == null) next[target] = mode;
    }
    storage.setItem("shakerrr_photo_mode", JSON.stringify(next));
  }

  for (const [oldId, cardId] of Object.entries(aliasToCard)) {
    if (oldId === cardId) continue;
    for (const prefix of ["shakerrr_my_", "shakerrr_social_"]) {
      const oldKey = prefix + oldId;
      const newKey = prefix + cardId;
      const value = storage.getItem(oldKey);
      if (value != null && storage.getItem(newKey) == null) storage.setItem(newKey, value);
    }
  }
}
