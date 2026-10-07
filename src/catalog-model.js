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

// A canonical classic card can contain source specs and named variants. The variant
// name remains on the version tab, so the underlying recipe is never flattened away.
// Search aliases preserve the old recipe IDs/names.
export const GROUP_RULES = {
  // Manhattan
  "manhattan-classic": { cardId: "manhattan", cardName: "Manhattan", variant: "Classic" },
  "manhattan-dry": { cardId: "manhattan", cardName: "Manhattan", variant: "Dry" },
  "manhattan-perfect": { cardId: "manhattan", cardName: "Manhattan", variant: "Perfect" },
  "simple-manhattan": { cardId: "manhattan", cardName: "Manhattan", variant: "Simple Manhattan" },
  "black-market-manhattan": { cardId: "manhattan", cardName: "Manhattan", variant: "Black Market" },

  // Martini family. Espresso-style drinks stay separate because they are a different identity.
  "fitty-fitty-martini": { cardId: "martini", cardName: "Martini", variant: "Fitty-Fitty" },
  "gibson": { cardId: "martini", cardName: "Martini", variant: "Gibson" },
  "mezcal-martini": { cardId: "martini", cardName: "Martini", variant: "Mezcal Martini" },

  // Margarita family. Visually distinct variants keep their own version-level image.
  "all-purpose-margarita": { cardId: "margarita", cardName: "Margarita", variant: "All-Purpose" },
  "margarita-classic": { cardId: "margarita", cardName: "Margarita", variant: "Classic" },
  "margarita-bitter-orange": { cardId: "margarita", cardName: "Margarita", variant: "Bitter Orange" },
  "margarita-cadillac": { cardId: "margarita", cardName: "Margarita", variant: "Cadillac" },
  "margarita-frozen": { cardId: "margarita", cardName: "Margarita", variant: "Frozen" },
  "margarita-hibiscus": { cardId: "margarita", cardName: "Margarita", variant: "Hibiscus" },
  "margarita-smoky-chili": { cardId: "margarita", cardName: "Margarita", variant: "Smoky Chili" },
  "margarita-spritz-strawberry": { cardId: "margarita", cardName: "Margarita", variant: "Strawberry Spritz" },
  "margarita-tamarind": { cardId: "margarita", cardName: "Margarita", variant: "Tamarind" },
  "tommys-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Tommy’s" },
  "simple-mezcal-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Simple Mezcal" },
  "mezcal-rita": { cardId: "margarita", cardName: "Margarita", variant: "Mezcal-Rita" },
  "mezcalrita": { cardId: "margarita", cardName: "Margarita", variant: "Mezcalrita" },
  "kiwi-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Kiwi" },
  "elote-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Elote" },
  "mangito-sonidero-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Mangito Sonidero" },
  "pina-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Piña" },
  "rosemary-cranberry-holiday-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Rosemary-Cranberry Holiday" },
  "smoky-ginger-margarita": { cardId: "margarita", cardName: "Margarita", variant: "Smoky Ginger" },

  // Daiquiri family
  "daiquiri-classic": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Classic" },
  "daiquiri-mulata": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Mulata" },
  "daiquiri-strawberry": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Strawberry" },
  "frozen-strawberry-daiquiri": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Frozen Strawberry" },
  "derby-daiquiri": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Derby" },
  "frozen-derby-daiquiri": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Frozen Derby" },
  "floridita-daiquiri": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Floridita" },
  "hemingway-daiquiri": { cardId: "daiquiri", cardName: "Daiquiri", variant: "Hemingway" },

  // Mojito family
  "mojito-classic": { cardId: "mojito", cardName: "Mojito", variant: "Classic" },
  "mojito-basic": { cardId: "mojito", cardName: "Mojito", variant: "Basic" },
  "mojito-a-mi-manera": { cardId: "mojito", cardName: "Mojito", variant: "A Mi Manera" },
  "mojito-tequila": { cardId: "mojito", cardName: "Mojito", variant: "Tequila" },

  // Negroni family
  "beachcomber-negroni": { cardId: "negroni", cardName: "Negroni", variant: "Beachcomber" },
  "frozen-negroni": { cardId: "negroni", cardName: "Negroni", variant: "Frozen" },
  "mezcal-negroni": { cardId: "negroni", cardName: "Negroni", variant: "Mezcal" },
  "negroni-sbagliato": { cardId: "negroni", cardName: "Negroni", variant: "Sbagliato" },
  "negroni-sour": { cardId: "negroni", cardName: "Negroni", variant: "Sour" },
  "negroni-tequila": { cardId: "negroni", cardName: "Negroni", variant: "Tequila" },
  "white-negroni": { cardId: "negroni", cardName: "Negroni", variant: "White" },
  "white-negroni-sbagliato": { cardId: "negroni", cardName: "Negroni", variant: "White Sbagliato" },

  // Old-Fashioned family
  "oaxaca-old-fashioned": { cardId: "old-fashioned", cardName: "Old-Fashioned", variant: "Oaxaca" },
  "oaxacan-old-fashioned": { cardId: "old-fashioned", cardName: "Old-Fashioned", variant: "Oaxacan" },

  // French 75 family
  "original-french-75": { cardId: "french-75", cardName: "French 75", variant: "Original" },
  "french-95": { cardId: "french-75", cardName: "French 75", variant: "French 95" },

  // Bloody Mary family
  "bloody-maria": { cardId: "bloody-mary", cardName: "Bloody Mary", variant: "Bloody Maria" },
  "mezcal-bloody-mary": { cardId: "bloody-mary", cardName: "Bloody Mary", variant: "Mezcal" },

  // Paloma family
  "earl-grey-paloma": { cardId: "paloma", cardName: "Paloma", variant: "Earl Grey" },
  "mezcal-paloma": { cardId: "paloma", cardName: "Paloma", variant: "Mezcal" },
  "spicy-paloma": { cardId: "paloma", cardName: "Paloma", variant: "Spicy" },

  // Mule family
  "mezcal-mule": { cardId: "moscow-mule", cardName: "Moscow Mule", variant: "Mezcal" },

  // Other source/name variants of the same classic
  "classic-cosmopolitan": { cardId: "cosmopolitan", cardName: "Cosmopolitan", variant: "Classic" },
  "planters-punch-rum": { cardId: "planters-punch", cardName: "Planter’s Punch", variant: "Rum" },
  "zombie-punch": { cardId: "zombie", cardName: "Zombie", variant: "Zombie Punch" },
};

const GROUP_TARGETS = new Map();
for (const rule of Object.values(GROUP_RULES)) {
  if (!GROUP_TARGETS.has(rule.cardId)) GROUP_TARGETS.set(rule.cardId, rule);
}

// Separate named riffs can share the same photograph when the finished visual is
// effectively the same. Grouped variants never need an entry here because their
// version image already falls back to the canonical card image.
export const VISUAL_FALLBACKS = {
  "oaxacan-dream": "margarita",
  "simplemente-delicioso": "margarita",
};

const sourcePriority = [
  "Shakerrr House Spec",
  "Shakerrr",
  "IBA",
  "Difford’s Guide",
  "Liquor.com",
  "Essential Cocktail Book",
  "Death & Co",
  "Tropical Standard",
  "Essential Cocktails 2021",
  "Agave Companion",
  "Holy Smoke! It’s Mezcal!",
  "Shakerrr Mezcal Library",
  "Liquid Intelligence",
  "Cocktails from Movies",
];

// Known extraction contamination that should never surface as a tab. This does
// not delete source data; it only keeps the bad version out of production.
function validSourceVersion(recipe, version) {
  if (
    recipe.id === "martini" &&
    version?.label === "Essential Cocktails 2021" &&
    clean(version?.note).includes("daiquiri mulata")
  ) return false;
  return version?.usable !== false;
}

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
  score += (recipe.versions || []).filter((v) => validSourceVersion(recipe, v)).length * 5;
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
      const sourceVersions = (recipe.versions || []).filter((v) => validSourceVersion(recipe, v));
      const usable = sourceVersions.length ? sourceVersions : (
        (recipe.versions || []).length ? [] : [versionFromRecipe(recipe)]
      );
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
