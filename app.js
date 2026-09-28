import {
  normalize,
  ingredient,
  garnish,
  missing,
  amount,
  searchText as coreSearch,
} from "./src/core.js";
import {
  readJSON,
  save,
  validURL,
  validateBackup,
  allowedKey,
} from "./src/storage.js";
("use strict");
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = {
  recipes: [],
  byId: new Map(),
  page: "discover",
  prevPage: "cocktails",
  unit: localStorage.getItem("shakerrr_unit") || "oz",
  filter: "All",
  query: "",
  favs: new Set(readJSON("shakerrr_favs", [])),
  bar: new Set(readJSON("shakerrr_bar", [])),
  current: null,
  world: [],
  country: null,
  searchIndex: -1,
  book: null,
  photoMode: readJSON("shakerrr_photo_mode", {}),
  images: {},
  region: "All",
  versionIndex: 0,
};
const NAV = [
  ["discover", "Discover"],
  ["cocktails", "Cocktails"],
  ["atlas", "Atlas"],
  ["bar", "My Bar"],
  ["families", "Families"],
  ["books", "Books"],
  ["movies", "Movies"],
  ["mezcal", "Mezcal"],
  ["amaro", "Amaro"],
  ["saved", "Saved"],
];
const BOOK_DESCRIPTIONS = {
  "Essential Cocktail Book":
    "Classic and modern reference recipes with strong photography.",
  "Essential Cocktails 2021":
    "Home-bartending classics, riffs, Mojitos, Margaritas, punches and seasonal drinks.",
  "Agave Companion":
    "Tequila and mezcal recipes, including Margaritas, Palomas, stirred drinks, dessert and savory drinks.",
  "Shakerrr Mezcal Library":
    "Mezcal-focused recipes and practical agave cocktails.",
  "Tropical Standard":
    "Tropical classics, modern technique and deeply reworked tiki/tropical drinks.",
  "Death & Co": "Modern cocktail specs from the Death & Co collection.",
  "Cocktails from Movies":
    "Cocktails paired with Paramount films and brief film context.",
  "Shakerrr World": "Country-specific drinks used by the Atlas.",
};
const AMARO = [
  ["Campari", 9, 3, 6, "orange, gentian, herbs", "Negroni / aperitivo"],
  ["Aperol", 4, 6, 8, "orange, rhubarb, herbs", "spritz / light bitter"],
  ["Cynar", 7, 5, 3, "artichoke, caramel, herbs", "earthy / vegetal"],
  ["Averna", 5, 8, 3, "cola, caramel, citrus, herbs", "dark / round"],
  ["Amaro Montenegro", 4, 7, 7, "orange, vanilla, florals", "soft / aromatic"],
  [
    "Amaro Nonino",
    4,
    6,
    6,
    "orange, alpine herbs, caramel",
    "elegant / bittersweet",
  ],
  [
    "Fernet-Branca",
    10,
    2,
    2,
    "mint, myrrh, saffron, roots",
    "fernet / intense",
  ],
  ["Branca Menta", 8, 5, 2, "mint, herbs, caramel", "minted fernet"],
  ["Ramazzotti", 6, 7, 5, "orange peel, cola, roots", "dark / citrus"],
  ["Braulio", 7, 4, 2, "pine, alpine herbs, mint", "alpine"],
  ["Sfumato Rabarbaro", 8, 4, 2, "smoke, rhubarb, roots", "rabarbaro / smoky"],
  ["Zucca Rabarbaro", 7, 5, 3, "rhubarb, smoke, herbs", "rabarbaro"],
  ["Amaro Lucano", 6, 6, 4, "caramel, herbs, citrus", "balanced dark amaro"],
  ["Meletti", 5, 7, 5, "cocoa, orange, spice", "sweet aromatic"],
  ["Cardamaro", 4, 6, 2, "cardoon, wine, nuts", "wine-based amaro"],
  ["Select Aperitivo", 6, 5, 7, "orange, herbs, spice", "Venetian aperitivo"],
  ["Cappelletti", 5, 6, 7, "orange, wine, herbs", "wine-based aperitivo"],
  [
    "Amaro dell’Etna",
    6,
    6,
    3,
    "orange, alpine herbs, caramel",
    "Sicilian herbal",
  ],
];
const FAMILY_TEMPLATES = {
  Highball: {
    core: 2,
    sweet: 0.2,
    acid: 0.2,
    bitter: 0.1,
    bubbles: 4,
    dilution: 4,
  },
  Sour: {
    core: 2,
    sweet: 0.75,
    acid: 0.75,
    bitter: 0.1,
    bubbles: 0,
    dilution: 1,
  },
  "Old Fashioned": {
    core: 2,
    sweet: 0.25,
    acid: 0,
    bitter: 0.7,
    bubbles: 0,
    dilution: 1,
  },
  Manhattan: {
    core: 2,
    sweet: 0.8,
    acid: 0,
    bitter: 0.35,
    bubbles: 0,
    dilution: 1,
  },
  Martini: {
    core: 2.5,
    sweet: 0.3,
    acid: 0,
    bitter: 0.15,
    bubbles: 0,
    dilution: 0.8,
  },
  Negroni: { core: 1, sweet: 1, acid: 0, bitter: 1, bubbles: 0, dilution: 1 },
  "Collins / Fizz": {
    core: 2,
    sweet: 0.75,
    acid: 0.75,
    bitter: 0.1,
    bubbles: 2.5,
    dilution: 2,
  },
  Punch: {
    core: 2,
    sweet: 0.7,
    acid: 0.7,
    bitter: 0.25,
    bubbles: 1,
    dilution: 3,
  },
};
const FAMILY_NODES = {
  Highball: [
    "Whisky Highball",
    "Gin and Tonic",
    "Paloma",
    "Cuba Libre",
    "Batanga",
    "Chilcano",
    "Dark ’n’ Stormy",
    "Mojito",
    "Americano",
    "Aperol Spritz",
  ],
  Sour: [
    "Daiquiri",
    "Margarita",
    "Whiskey Sour",
    "Pisco Sour",
    "Sidecar",
    "Bee’s Knees",
    "Last Word",
    "Paper Plane",
  ],
  "Old Fashioned": [
    "Old-Fashioned",
    "Oaxaca Old-Fashioned",
    "Sazerac",
    "Toronto",
    "Corn ’n’ Oil",
  ],
  Manhattan: [
    "Manhattan",
    "Rob Roy",
    "Rhythm and Soul",
    "Black Manhattan",
    "Tipperary",
    "Capitán",
  ],
  Martini: ["Martini", "Gibson", "Vesper", "Bamboo", "Fitty-Fitty Martini"],
  Negroni: [
    "Negroni",
    "Boulevardier",
    "Americano",
    "White Negroni",
    "Negroni Sbagliato",
    "Mezcal Negroni",
  ],
  "Collins / Fizz": [
    "Tom Collins",
    "Gin Fizz",
    "Ramos Gin Fizz",
    "Mojito",
    "Bitter Tom",
    "French 75",
  ],
  Punch: [
    "Planter’s Punch",
    "Mai Tai",
    "Zombie",
    "Rum Punch",
    "Pimm’s Cup",
    "Scorpion Bowl",
  ],
};
let photoObserver = null;
const FAMILY_SWAPS = {
  Negroni: [
    "Gin → bourbon or rye = Boulevardier direction",
    "Campari → Aperol = lighter, sweeter, less bitter",
    "Replace gin with sparkling wine = Sbagliato direction",
  ],
  Sour: [
    "Rum + lime = Daiquiri direction",
    "Tequila + lime = Margarita direction",
    "Whiskey + lemon = Whiskey Sour direction",
  ],
  Highball: [
    "Whisky + soda = Whisky Highball",
    "Gin + tonic = Gin & Tonic",
    "Tequila + grapefruit + bubbles = Paloma direction",
  ],
  Manhattan: [
    "Rye + sweet vermouth = Manhattan",
    "Scotch + sweet vermouth = Rob Roy",
    "Swap vermouth for amaro = Black Manhattan direction",
  ],
  Martini: [
    "Gin + dry vermouth = Martini",
    "Vodka + dry vermouth = Vodka Martini",
    "Add olive brine = Dirty Martini direction",
  ],
  "Old Fashioned": [
    "Whiskey + sugar + bitters = Old Fashioned",
    "Rye + absinthe rinse = Sazerac direction",
    "Tequila/mezcal base = Oaxaca Old Fashioned direction",
  ],
  "Collins / Fizz": [
    "A Sour + soda = Collins",
    "Gin + citrus + sugar + soda = Gin Fizz",
    "Sparkling wine as lengthener = French 75 direction",
  ],
  Punch: [
    "Spirit + citrus + sugar + water = punch structure",
    "Add tea or spice for seasoning",
    "Increase dilution and scale while keeping balance",
  ],
};
const LABELS = {
  core: "Base spirit / core",
  sweet: "Sweet modifier",
  acid: "Acid / citrus",
  bitter: "Bitters / seasoning",
  bubbles: "Bubbles / lengthener",
  dilution: "Water / dilution",
};
const REGION_BY_COUNTRY = {
  Argentina: "Latin America",
  Australia: "Oceania",
  Barbados: "Caribbean",
  Bermuda: "Caribbean",
  Brazil: "Latin America",
  "British Virgin Islands": "Caribbean",
  Canada: "North America",
  Chile: "Latin America",
  Colombia: "Latin America",
  Cuba: "Caribbean",
  Ecuador: "Latin America",
  France: "Western Europe",
  Ireland: "Western Europe",
  Italy: "Mediterranean",
  Japan: "East Asia",
  Malaysia: "Southeast Asia",
  Mexico: "Latin America",
  Peru: "Latin America",
  Portugal: "Mediterranean",
  Singapore: "Southeast Asia",
  "South Korea": "East Asia",
  Spain: "Mediterranean",
  Thailand: "Southeast Asia",
  "Trinidad and Tobago": "Caribbean",
  "United Kingdom": "Western Europe",
  "United States": "North America",
};
const REGION_ORDER = [
  "All",
  "Caribbean",
  "Latin America",
  "North America",
  "Mediterranean",
  "Western Europe",
  "East Asia",
  "Southeast Asia",
  "Oceania",
];
async function boot() {
  try {
    const [recipes, world, images] = await Promise.all(
      ["recipes", "world", "image-manifest"].map(async (name) => {
        const r = await fetch(`data/${name}.json`);
        if (!r.ok) throw Error(name);
        return r.json();
      }),
    );
    state.recipes = recipes;
    state.world = world;
    state.images = images.byRecipe || {};
    state.bar = new Set([...state.bar].map(canon));
    state.recipes.forEach((r) => {
      state.byId.set(r.id, r);
      r.searchIndex = searchText(r);
    });
    buildNav();
    wireGlobal();
    go(location.hash.slice(1) || "discover", false);
    $("#unitBtn").textContent = state.unit;
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("./sw.js")
        .catch((e) => console.warn("Offline cache unavailable", e));
  } catch (e) {
    console.error(e);
    $("#main").innerHTML =
      '<div class="empty">The catalog could not load. Check your connection and reload.</div>';
  }
}
function buildNav() {
  const h = NAV.map(([id, l]) => `<button data-nav="${id}">${l}</button>`).join(
    "",
  );
  $("#nav").innerHTML = h;
  $("#mobileNav").innerHTML =
    NAV.slice(0, 4)
      .map(([id, l]) => `<button data-nav="${id}">${l}</button>`)
      .join("") + '<button data-action="open-drawer">More</button>';
}
function wireGlobal() {
  document.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      go(nav.dataset.nav);
      return;
    }
    const a = e.target.closest("[data-action]");
    if (a) {
      await action(a.dataset.action, a, e);
      return;
    }
    const rec = e.target.closest("[data-recipe]");
    if (rec) {
      openRecipe(rec.dataset.recipe);
      return;
    }
    const ver = e.target.closest("[data-version]");
    if (ver) {
      renderVersion(+ver.dataset.version);
      return;
    }
    const country = e.target.closest("[data-country]");
    if (country) {
      selectCountry(country.dataset.country);
      return;
    }
    const book = e.target.closest("[data-book]");
    if (book) {
      state.book = decodeURIComponent(book.dataset.book);
      go("books");
      return;
    }
    const chip = e.target.closest("[data-bar]");
    if (chip) {
      toggleBar(decodeURIComponent(chip.dataset.bar));
      return;
    }
    if (!e.target.closest(".search")) closeSearch();
  });
  document.addEventListener("keydown", (e) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.matches("[role=button][data-recipe]")
    ) {
      e.preventDefault();
      openRecipe(e.target.dataset.recipe);
    }
  });
  $("#searchInput").addEventListener("input", (e) => search(e.target.value));
  $("#searchInput").addEventListener("keydown", (e) => {
    const items = $$(".search-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.searchIndex = Math.min(items.length - 1, state.searchIndex + 1);
      focusSearch(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.searchIndex = Math.max(0, state.searchIndex - 1);
      focusSearch(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = items[state.searchIndex >= 0 ? state.searchIndex : 0];
      if (t) openRecipe(t.dataset.recipe);
    } else if (e.key === "Escape") closeSearch();
  });
  $("#unitBtn").addEventListener("click", () => {
    state.unit = state.unit === "oz" ? "ml" : "oz";
    localStorage.setItem("shakerrr_unit", state.unit);
    $("#unitBtn").textContent = state.unit;
    if (state.current) renderVersion(state.versionIndex);
  });
  $("#toolsBtn").addEventListener("click", openDrawer);
  window.addEventListener("hashchange", () => {
    const h = location.hash.slice(1);
    if (h && h !== state.page) go(h, false);
  });
  $("#photoUpload").addEventListener("change", handlePhotoUpload);
}
function focusSearch(items) {
  items.forEach((x, i) =>
    x.classList.toggle("focused", i === state.searchIndex),
  );
  items[state.searchIndex]?.scrollIntoView({ block: "nearest" });
}
function go(page, push = true) {
  if (!NAV.some((n) => n[0] === page)) page = "discover";
  closeDrawer();
  closeModal();
  state.current = null;
  state.page = page;
  if (push) history.replaceState(null, "", "#" + page);
  $$("[data-nav]").forEach((b) =>
    b.classList.toggle("active", b.dataset.nav === page),
  );
  closeSearch();
  renderPage();
  scrollTo(0, 0);
}
function renderPage() {
  const r = {
    discover: renderDiscover,
    cocktails: renderCocktails,
    atlas: renderAtlas,
    bar: renderBar,
    families: renderFamilies,
    books: renderBooks,
    movies: renderMovies,
    mezcal: renderMezcal,
    amaro: renderAmaro,
    saved: renderSaved,
    detail: () => renderDetail(state.current),
  }[state.page];
  r?.();
}
function searchText(r) {
  return coreSearch(r);
}
function search(q) {
  state.query = q.trim();
  state.searchIndex = -1;
  const box = $("#searchResults"),
    s = normalize(q);
  if (!s) {
    closeSearch();
    return;
  }
  const a = state.recipes
    .filter((r) => r.searchIndex.includes(s))
    .sort(
      (a, b) =>
        Number(normalize(b.name).startsWith(s)) -
          Number(normalize(a.name).startsWith(s)) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 24);
  box.innerHTML = a.length
    ? a
        .map(
          (r) =>
            `<button class="search-item" data-recipe="${r.id}" role="option"><b>${esc(r.name)}</b><span>${esc([r.family, r.country, ...(r.collections || [])].filter(Boolean).join(" · "))}</span></button>`,
        )
        .join("")
    : '<div class="search-item">No matching recipe. Try a name, ingredient, book, film or region.</div>';
  box.classList.add("open");
}
function closeSearch() {
  $("#searchResults").classList.remove("open");
  state.searchIndex = -1;
}
function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function attr(s = "") {
  return esc(s).replace(/`/g, "&#96;");
}
function displayAmt(a) {
  return amount(a, state.unit);
}
function recipeCountByCountry() {
  const m = new Map();
  state.recipes.forEach((r) => {
    if (r.country) {
      if (!m.has(r.country)) m.set(r.country, []);
      m.get(r.country).push(r);
    }
  });
  return m;
}
function card(r) {
  return `<article class="card" role="button" tabindex="0" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">finding photo</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"><span class="badge">${esc(r.category)}</span><button class="heart" data-action="fav" data-id="${r.id}" aria-label="Favourite">${state.favs.has(r.id) ? "♥" : "♡"}</button></div><div class="card-body"><div class="origin">${esc(r.country || r.collections?.[0] || "Shakerrr")}</div><h3>${esc(r.name)}</h3><div class="ingredient-line">${esc(
    (r.ingredients || [])
      .slice(0, 5)
      .map((i) => i.name)
      .join(" · "),
  )}</div><div class="tags"><span class="tag gold">${esc(r.method || "Recipe")}</span>${r.family ? `<span class="tag blue">${esc(r.family)}</span>` : ""}${r.versions?.length > 1 ? `<span class="tag">${r.versions.length} versions</span>` : ""}</div></div></article>`;
}
function hydratePhotos(root = $("#main")) {
  if (!root) return;
  if (!photoObserver && "IntersectionObserver" in window)
    photoObserver = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            photoObserver.unobserve(en.target);
            loadPhoto(en.target.dataset.photoId, en.target);
          }
        }),
      { rootMargin: "350px" },
    );
  $$("img[data-photo-id]:not([data-photo-wired])", root).forEach((img) => {
    img.dataset.photoWired = "1";
    if (img.closest(".detail-photo") || !photoObserver)
      loadPhoto(img.dataset.photoId, img);
    else photoObserver.observe(img);
  });
}
function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
function renderDiscover() {
  const countryN = recipeCountByCountry().size;
  const featured = [
    "Padang Swizzle",
    "Rhythm and Soul",
    "Bitter Tom",
    "Negroni",
    "Naked And Famous",
    "Donn’s Demon",
    "Jungle Bird",
    "Paper Plane",
  ]
    .map((n) =>
      state.recipes.find((r) => r.name.toLowerCase() === n.toLowerCase()),
    )
    .filter(Boolean);
  const hero =
    featured[0] || state.recipes.find((r) => r.image) || state.recipes[0];
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="hero"><div class="hero-media"><img data-photo-id="${hero.id}" alt="${attr(hero.name)}"></div><div class="hero-copy"><div class="kicker">MJ Cocktail Reference</div><h1>Recipes, versions, bottles and the relationships between drinks.</h1><p>${state.recipes.length} recipes are searchable in one place, including modern, obscure, book, movie, mezcal, tropical and international drinks. Open a recipe to compare versions, save your own spec, or use your own photo.</p><div class="btnrow"><button class="primary" data-nav="cocktails">Browse recipes</button><button class="secondary" data-action="surprise">Surprise me</button><button class="secondary" data-nav="families">Open family graph</button></div><div class="hero-stats"><div><b>${state.recipes.length}</b><small>recipes</small></div><div><b>${countryN}</b><small>countries</small></div><div><b>${Object.keys(BOOK_DESCRIPTIONS).length}</b><small>collections</small></div></div></div></div><div class="section-head"><div><h2>Go straight to the useful part</h2></div></div><div class="quick-grid"><button class="quick" data-nav="bar"><b>01</b><h3>My Bar</h3><p>What you can make now, what is one ingredient away, and what a bottle unlocks.</p></button><button class="quick" data-nav="atlas"><b>02</b><h3>World Atlas</h3><p>Actual country-tagged recipes only.</p></button><button class="quick" data-action="swap"><b>03</b><h3>Swap Lab</h3><p>See every recipe affected when you replace an ingredient.</p></button><button class="quick" data-nav="books"><b>04</b><h3>Book shelves</h3><p>Death & Co, Tropical Standard, agave books, Essential Cocktail books and more.</p></button></div><div class="section-head"><div><h2>MJ shelf</h2><p>Famous and less-known drinks mixed together.</p></div><button class="text-link" data-nav="cocktails">All recipes ↗</button></div><div class="cards">${featured.map(card).join("")}</div></div></section>`;
  hydratePhotos();
}
function filteredRecipes(base = state.recipes) {
  let a = base;
  if (state.filter !== "All") {
    if (
      [
        "Classic",
        "Modern",
        "International",
        "Tropical",
        "Movies",
        "Mezcal",
      ].includes(state.filter)
    )
      a = a.filter(
        (r) =>
          r.category === state.filter ||
          r.tags?.includes(state.filter.toLowerCase()),
      );
    else if (state.filter === "Favourites")
      a = a.filter((r) => state.favs.has(r.id));
    else a = a.filter((r) => r.family === state.filter);
  }
  return a;
}
function renderCocktails() {
  const arr = filteredRecipes();
  const filters = [
    "All",
    "Classic",
    "Modern",
    "International",
    "Tropical",
    "Mezcal",
    "Highball",
    "Sour",
    "Negroni",
    "Martini",
    "Favourites",
  ];
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails</h1><p class="subtitle">Search, filter, open, compare, save.</p></div><div class="filters">${filters.map((f) => `<button class="pill ${state.filter === f ? "active" : ""}" data-action="filter" data-filter="${attr(f)}">${esc(f)}</button>`).join("")}</div></div><div class="countline">${arr.length} / ${state.recipes.length} recipes</div><div class="cards">${arr.map(card).join("")}</div></div></section>`;
  hydratePhotos();
}
function openRecipe(id) {
  if (!state.byId.has(id)) return;
  closeDrawer();
  closeModal();
  if (state.page !== "detail") state.prevPage = state.page;
  state.current = id;
  state.page = "detail";
  state.versionIndex = 0;
  closeSearch();
  renderDetail(id);
  scrollTo(0, 0);
}
function renderDetail(id) {
  const r = state.byId.get(id);
  if (!r) return;
  state.current = id;
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><button class="back" data-nav="${state.prevPage || "cocktails"}">← Back</button><div class="detail"><div class="detail-photo"><span class="photo-status">Loading photograph</span><img data-photo-id="${id}" alt="${attr(r.name)}"><div class="photo-credit"></div><div class="photo-controls">${[
      ["upload-photo", "Upload my photo"],
      ["use-my-photo", "Use my photo"],
      ["use-system-photo", "Use Shakerrr photo"],
      ["remove-my-photo", "Remove my photo"],
      ["refresh-photo", "Refresh system photo"],
    ]
      .map(
        ([a, t]) => `<button data-action="${a}" data-id="${id}">${t}</button>`,
      )
      .join(
        "",
      )}</div></div><div class="detail-copy"><div class="eyebrow">${esc([r.family, r.country, r.region].filter(Boolean).join(" · "))}</div><h1>${esc(r.name)}</h1><button class="mini-btn" data-action="fav" data-id="${id}" aria-label="Favourite">${state.favs.has(id) ? "♥" : "♡"}</button>${r.movie ? `<div class="note-box"><b>${esc(r.movie.film)} ${esc(r.movie.year || "")}</b>${esc(r.movie.fact || r.movie.context || "Book pairing; not a claim that the drink appears on screen.")}</div>` : ""}<div class="version-section"><h2>Recipe versions</h2><div id="versionMount"></div></div></div></div></div></section>`;
  renderVersions(r);
  hydratePhotos();
}
function allVersions(r) {
  const out = (r.versions || []).filter((v) => v.usable !== false);
  if (!out.length)
    out.push({
      label: r.baseSource || "Recovered reference",
      ingredients: r.ingredients,
      instructions: r.instructions,
      garnish: r.garnish,
      note: r.note,
    });
  let personal = localStorage.getItem("shakerrr_my_" + r.id) || "";
  try {
    personal = JSON.parse(personal);
  } catch {
    personal = { note: personal };
  }
  out.push({
    ...personal,
    label: "MJ Personal Version",
    key: "mine",
    mine: true,
  });
  readJSON("shakerrr_social_" + r.id, []).forEach((v, i) =>
    out.push({
      ...v,
      label: `${v.platform || "Social"} · ${v.creator || "Creator"}`,
      key: "social" + i,
      type: "Social",
    }),
  );
  out.push({ label: "+ Social recipe", key: "addsocial", addsocial: true });
  return out;
}
function renderVersions(r) {
  const vs = allVersions(r);
  $("#versionMount").innerHTML =
    `<div class="version-tabs" role="tablist" aria-label="Recipe source">${vs.map((v, i) => `<button class="version-tab" role="tab" aria-selected="false" data-version="${i}">${esc(v.label)}</button>`).join("")}</div><div id="versionPane" role="tabpanel"></div>`;
  renderVersion(Math.min(state.versionIndex || 0, vs.length - 1));
}
function renderVersion(i) {
  const r = state.byId.get(state.current),
    v = allVersions(r)[i];
  if (!v) return;
  state.versionIndex = i;
  $$(".version-tab").forEach((b, j) => {
    b.classList.toggle("active", i === j);
    b.setAttribute("aria-selected", String(i === j));
  });
  const pane = $("#versionPane");
  if (v.mine || v.addsocial) {
    pane.innerHTML = recipeForm(v, !!v.addsocial);
    return;
  }
  pane.innerHTML = `<div class="version-pane"><div class="source-head"><b>${esc(v.label)}</b><span>${esc(v.type || "Published reference")}</span></div>${v.page ? `<p>Source page ${esc(v.page)}</p>` : ""}${v.creator ? `<p>${esc(v.creator)}</p>` : ""}${validURL(v.url) ? `<a href="${attr(validURL(v.url))}" target="_blank" rel="noopener">Original source ↗</a>` : ""}<table class="ingredient-table"><tbody>${(v.ingredients || []).map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(displayAmt(x.amount))}</td></tr>`).join("")}</tbody></table><div class="method-box"><b>Preparation</b>${esc(v.instructions || "")}</div>${[
    "glass",
    "ice",
    "garnish",
    "note",
  ]
    .filter((k) => v[k])
    .map(
      (k) =>
        `<div class="note-box"><b>${esc(k === "note" ? "Notes" : k)}</b>${esc(v[k])}</div>`,
    )
    .join(
      "",
    )}${v.photo && /^data:image\/(png|jpeg|webp);base64,/.test(v.photo) ? `<img class="version-photo" src="${attr(v.photo)}" alt="Personal version photograph">` : ""}</div>`;
  const img = $(".detail-photo img");
  if (img) loadPhoto(r.id, img);
}
function renderBooks() {
  const groups = {};
  state.recipes.forEach((r) =>
    (r.collections || []).forEach((c) => {
      if (c === "Shakerrr") return;
      (groups[c] ??= []).push(r);
    }),
  );
  if (state.book && groups[state.book]) {
    const arr = groups[state.book];
    $("#main").innerHTML =
      `<section class="page"><div class="shell"><button class="back" data-action="book-back">← All books</button><div class="toolbar"><div><h1>${esc(state.book)}</h1><p class="subtitle">${esc(BOOK_DESCRIPTIONS[state.book] || "Recipe collection")}</p></div></div><div class="countline">${arr.length} recipes</div><div class="cards">${arr.map(card).join("")}</div></div></section>`;
    hydratePhotos();
    return;
  }
  state.book = null;
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Books</h1><p class="subtitle">Recipes extracted into Shakerrr, with book photographs when available.</p></div></div><div class="collection-grid">${Object.entries(
      groups,
    )
      .sort((a, b) => b[1].length - a[1].length)
      .map(
        ([c, a]) =>
          `<button class="collection" data-book="${encodeURIComponent(c)}"><b>${a.length}</b><h3>${esc(c)}</h3><p>${esc(BOOK_DESCRIPTIONS[c] || "Recipe collection")}</p></button>`,
      )
      .join("")}</div></div></section>`;
}
function renderMovies() {
  const a = state.recipes.filter(
    (r) => r.movie || r.collections?.includes("Cocktails from Movies"),
  );
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails from Movies</h1><p class="subtitle">Cocktail + film pairing with a compact film note.</p></div></div><div class="countline">${a.length} movie cocktails</div><div class="movies-grid">${a.map((r) => `<button class="movie-card" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">finding photo</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"></div><div class="movie-meta"><small>${esc([r.movie?.film, r.movie?.year].filter(Boolean).join(" · ") || "Cinema")}</small><h3>${esc(r.name)}</h3><p>${esc(r.note || r.movie?.fact || "")}</p></div></button>`).join("")}</div></div></section>`;
  hydratePhotos();
}
function renderMezcal() {
  const a = state.recipes.filter(
    (r) =>
      r.tags?.includes("mezcal") ||
      r.category === "Mezcal" ||
      r.ingredients?.some((i) => /mezcal/i.test(i.name)),
  );
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Mezcal & Agave</h1><p class="subtitle">Mezcal, tequila and agave-focused recipes from the dedicated books plus Shakerrr.</p></div></div><div class="countline">${a.length} recipes</div><div class="cards">${a.map(card).join("")}</div></div></section>`;
  hydratePhotos();
}
function renderAmaro() {
  const usage = (n) =>
    state.recipes.filter((r) =>
      r.ingredients?.some((i) =>
        i.name.toLowerCase().includes(n.toLowerCase().replace("amaro ", "")),
      ),
    );
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Amaro Reference</h1><p class="subtitle">The full reference is back as its own workspace. Click any bottle to see recipes using it.</p></div></div><div class="amaro-table-wrap"><table class="amaro-table"><thead><tr><th>Amaro / Aperitivo</th><th>Bitterness</th><th>Sweetness</th><th>Citrus</th><th>Profile</th><th>Style</th><th>Recipes</th></tr></thead><tbody>${AMARO.map((x) => `<tr data-action="amaro-recipes" data-amaro="${attr(x[0])}"><td><b>${esc(x[0])}</b></td><td>${meter(x[1])}</td><td>${meter(x[2])}</td><td>${meter(x[3])}</td><td>${esc(x[4])}</td><td>${esc(x[5])}</td><td>${usage(x[0]).length}</td></tr>`).join("")}</tbody></table></div></div></section>`;
}
function meter(n) {
  return `<div class="meter"><i style="width:${n * 10}%"></i></div>`;
}
function renderSaved() {
  const a = state.recipes.filter((r) => state.favs.has(r.id));
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Saved</h1><p class="subtitle">Favourites and personal versions stay on this device.</p></div></div>${a.length ? `<div class="cards">${a.map(card).join("")}</div>` : '<div class="empty">No favourites yet.</div>'}</div></section>`;
  hydratePhotos();
}
function renderBar() {
  const m = barMatches(),
    all = [
      ...new Set(
        state.recipes.flatMap((r) =>
          r.ingredients.filter((i) => !garnish(i)).map((i) => canon(i.name)),
        ),
      ),
    ].sort(),
    unlocks = new Map();
  m.filter((x) => x.miss.length === 1).forEach((x) =>
    unlocks.set(x.miss[0], (unlocks.get(x.miss[0]) || 0) + 1),
  );
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><h1>My Bar</h1><p>Select what you have. Garnishes are optional; specific rum, vermouth and tequila styles stay distinct.</p><label for="barSearch">Find an ingredient</label><input id="barSearch" class="form-control" placeholder="Gin, citrus, bitters…"><div id="barChoices" class="bar-chips"></div><div class="metrics">${[0, 1, 2].map((n) => `<button class="pill" data-action="bar-filter" data-count="${n}">${n === 0 ? "Make Now" : "Missing " + (n === 1 ? "One" : "Two")} (${m.filter((x) => x.miss.length === n).length})</button>`).join("")}</div><h2>What to buy next</h2><div class="bar-chips">${
      [...unlocks]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(
          ([n, c]) =>
            `<button class="pill" data-bar="${encodeURIComponent(n)}">${esc(n)} · unlocks ${c}</button>`,
        )
        .join("") ||
      "<p>Select your inventory to calculate useful additions.</p>"
    }</div><div id="barResults"></div></div></section>`;
  const choices = () => {
    $("#barChoices").innerHTML = all
      .filter(
        (n) =>
          !$("#barSearch").value ||
          normalize(n).includes(normalize($("#barSearch").value)),
      )
      .slice(0, 100)
      .map(
        (n) =>
          `<button class="pill ${state.bar.has(n) ? "active" : ""}" aria-pressed="${state.bar.has(n)}" data-bar="${encodeURIComponent(n)}">${esc(n)}</button>`,
      )
      .join("");
  };
  $("#barSearch").addEventListener("input", choices);
  choices();
  renderBarResults(state.barFilter || 0);
}
function canon(n) {
  return ingredient(n).id;
}
function isGarnish(n) {
  return garnish(n);
}
function scoreBar() {
  return state.recipes
    .map((r) => {
      const needs = [
        ...new Set(
          (r.ingredients || [])
            .filter((i) => !isGarnish(i.name) && i.amount !== "—")
            .map((i) => canon(i.name))
            .filter(Boolean),
        ),
      ];
      const miss = needs.filter((n) => !state.bar.has(n));
      return { r, miss };
    })
    .sort(
      (a, b) =>
        a.miss.length - b.miss.length || a.r.name.localeCompare(b.r.name),
    );
}
function toggleBar(n) {
  state.bar.has(n) ? state.bar.delete(n) : state.bar.add(n);
  localStorage.setItem("shakerrr_bar", JSON.stringify([...state.bar]));
  renderBar();
}
function renderAtlas() {
  const cm = recipeCountByCountry();
  if (!state.country || !cm.has(state.country))
    state.country = [...cm.keys()].sort()[0];
  $("#main").innerHTML =
    '<section class="page"><div class="shell"><div class="atlas"><div class="map-wrap"><div class="map-head"><div class="kicker">Shakerrr Atlas</div><h1>' +
    cm.size +
    ' countries with recipes.</h1><p>Browse real catalog coverage by region or country. Shakerrr does not invent geographic associations to fill the map.</p><div class="region-chips">' +
    REGION_ORDER.map(
      (x) =>
        '<button class="pill ' +
        (state.region === x ? "active" : "") +
        '" data-action="region-filter" data-region="' +
        attr(x) +
        '">' +
        esc(x) +
        "</button>",
    ).join("") +
    '</div></div><svg id="worldSvg" class="world-svg" viewBox="0 0 1000 500" aria-label="Cocktail world map"></svg></div><aside class="atlas-side"><h2>Country index</h2><input id="countrySearch" class="country-search" placeholder="Find country or region..." aria-label="Find country or region"><div id="countryList" class="country-list"></div><div id="countryDetail" class="country-detail"></div></aside></div></div></section>';
  drawWorld();
  renderCountryList("");
  $("#countrySearch").addEventListener("input", (e) =>
    renderCountryList(e.target.value),
  );
}
function drawWorld() {
  const svg = $("#worldSvg"),
    cm = recipeCountByCountry(),
    nameMap = {
      "United States of America": "United States",
      "Dominican Rep.": "Dominican Republic",
      "Bosnia and Herz.": "Bosnia and Herzegovina",
      "Trinidad and Tobago": "Trinidad and Tobago",
    };
  let html = "";
  state.world.forEach((f) => {
    const n = nameMap[f.name] || f.name;
    f.polys.forEach((poly) => {
      const d =
        poly
          .map(
            (p, i) =>
              `${i ? "L" : "M"}${(((p[0] + 180) / 360) * 1000).toFixed(1)},${(((90 - p[1]) / 180) * 500).toFixed(1)}`,
          )
          .join(" ") + " Z";
      html += `<path d="${d}" class="country-path ${cm.has(n) ? "has" : ""} ${state.country === n ? "focus" : ""}" ${cm.has(n) ? `data-country="${attr(n)}"` : ""}></path>`;
    });
  });
  svg.innerHTML = html;
}
function renderCountryList(q = "") {
  const cm = recipeCountByCountry(),
    t = q.toLowerCase(),
    arr = [...cm.entries()]
      .filter(
        ([n]) =>
          (state.region === "All" || regionFor(n) === state.region) &&
          (!t ||
            n.toLowerCase().includes(t) ||
            regionFor(n).toLowerCase().includes(t)),
      )
      .sort((a, b) => a[0].localeCompare(b[0]));
  $("#countryList").innerHTML = arr.length
    ? arr
        .map(
          ([n, a]) =>
            '<button class="country-row" data-country="' +
            attr(n) +
            '"><span><b>' +
            esc(n) +
            "</b><small>" +
            esc(regionFor(n)) +
            "</small></span><span>" +
            a.length +
            "</span></button>",
        )
        .join("")
    : '<div class="empty compact">No country matches this region/search.</div>';
  if (arr.length && (!state.country || !arr.some(([n]) => n === state.country)))
    state.country = arr[0][0];
  renderCountryDetail();
}
function selectCountry(n) {
  state.country = n;
  drawWorld();
  renderCountryDetail();
}
function renderCountryDetail() {
  const cm = recipeCountByCountry(),
    a = (cm.get(state.country) || [])
      .slice()
      .sort((x, y) => x.name.localeCompare(y.name));
  $("#countryDetail").innerHTML =
    "<h3>" +
    esc(state.country || "") +
    '</h3><p class="subtitle">' +
    esc(regionFor(state.country)) +
    " · " +
    a.length +
    " recipes</p>" +
    a
      .map(
        (r) =>
          '<button class="country-drink" data-recipe="' +
          r.id +
          '">' +
          esc(r.name) +
          "</button>",
      )
      .join("");
}
function renderFamilies() {
  const vals = JSON.parse(
    localStorage.getItem("shakerrr_family") ||
      JSON.stringify(FAMILY_TEMPLATES.Sour),
  );
  $("#main").innerHTML =
    `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktail Families</h1><p class="subtitle">Start with a known family, then move one control at a time. The graph shows drinks built from the closest structure.</p></div></div><div class="family-help"><b>How to use it</b><span>1. Pick a family</span><span>2. Move one slider</span><span>3. Read the concrete swaps</span><span>4. Click a drink to open its recipe</span></div><div class="family-presets">${Object.keys(
      FAMILY_TEMPLATES,
    )
      .map(
        (f) =>
          `<button data-action="family-preset" data-family-name="${attr(f)}">${esc(f)}</button>`,
      )
      .join(
        "",
      )}</div><div class="family-layout"><div class="family-stage"><svg id="familySvg" class="family-svg" viewBox="0 0 900 610"></svg></div><div class="panel controls-panel"><h2>Change the structure</h2><p>The numbers are ratios, not ingredients. Use the swap examples below to translate the structure into real drinks.</p>${Object.keys(
      LABELS,
    )
      .map(
        (k) =>
          `<label>${LABELS[k]} <span id="fv-${k}">${vals[k]}</span></label><input type="range" min="0" max="${k === "bubbles" || k === "dilution" ? 5 : k === "core" ? 3 : 2}" step="0.05" value="${vals[k]}" data-family-control="${k}">`,
      )
      .join(
        "",
      )}<div id="familyResult" class="family-result"></div></div></div></div></section>`;
  $$("[data-family-control]").forEach((x) =>
    x.addEventListener("input", () => updateFamily()),
  );
  updateFamily();
}
function currentFamilyValues() {
  const o = {};
  $$("[data-family-control]").forEach((x) => {
    o[x.dataset.familyControl] = +x.value;
    $("#fv-" + x.dataset.familyControl).textContent = (+x.value)
      .toFixed(2)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  });
  return o;
}
function nearestFamily(v) {
  let best = null;
  for (const [name, t] of Object.entries(FAMILY_TEMPLATES)) {
    let d = 0;
    for (const k of Object.keys(t))
      d += Math.pow((v[k] - t[k]) / (k === "bubbles" ? 2 : 1), 2);
    if (!best || d < best.d) best = { name, d };
  }
  return best.name;
}
function updateFamily() {
  const v = currentFamilyValues();
  localStorage.setItem("shakerrr_family", JSON.stringify(v));
  const fam = nearestFamily(v),
    nodes = (FAMILY_NODES[fam] || [])
      .map((n) => state.recipes.find((r) => normName(r.name) === normName(n)))
      .filter(Boolean)
      .slice(0, 9);
  const svg = $("#familySvg"),
    cx = 450,
    cy = 305,
    R = 225;
  let h = `<circle cx="${cx}" cy="${cy}" r="82" fill="#17140f" stroke="#c99a50" stroke-width="2"></circle><text x="${cx}" y="${cy - 5}" fill="#eee8de" text-anchor="middle" style="font:28px Georgia">${esc(fam)}</text><text x="${cx}" y="${cy + 20}" fill="#c99a50" text-anchor="middle" style="font:10px monospace">CORE ${v.core} · SWEET ${v.sweet} · ACID ${v.acid}</text>`;
  nodes.forEach((r, i) => {
    const ang = (Math.PI * 2 * i) / nodes.length - Math.PI / 2,
      x = cx + Math.cos(ang) * R,
      y = cy + Math.sin(ang) * R;
    h += `<line class="family-line" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line><g role="button" tabindex="0" class="family-node" data-recipe="${r.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="48"></circle><text x="${x}" y="${y - 3}">${esc(r.name.length > 19 ? r.name.slice(0, 17) + "…" : r.name)}</text><text class="sub" x="${x}" y="${y + 16}">${esc(r.country || r.method || "")}</text></g>`;
  });
  svg.innerHTML = h;
  const swaps = FAMILY_SWAPS[fam] || [];
  $("#familyResult").innerHTML =
    `<div class="kicker">Closest structure</div><h3>${esc(fam)}</h3><p>${familyExplain(fam)}</p><div class="swap-examples"><b>Concrete changes</b>${swaps.map((s) => `<span>${esc(s)}</span>`).join("")}</div><button class="mini-btn" data-action="family-filter" data-family="${attr(fam)}">Show ${esc(fam)} recipes</button>`;
}
function familyExplain(f) {
  return (
    {
      Highball:
        "Core spirit lengthened with a carbonated or non-alcoholic component. Changing the lengthener quickly creates Paloma, Cuba Libre, Gin & Tonic and related drinks.",
      Sour: "Core + acid + sweetness. Change the core and seasoning and the same balance becomes a Daiquiri, Margarita, Whiskey Sour, Pisco Sour or Sidecar direction.",
      "Old Fashioned":
        "Spirit-forward core with small sweetness and bitters as seasoning.",
      Manhattan:
        "Spirit + fortified wine + bitters. The modifier can move the drink from Manhattan toward Rob Roy, Black Manhattan, Capitán or related forms.",
      Martini: "Spirit + dry/fortified modifier with very little sweetness.",
      Negroni:
        "Core + bitter + fortified sweet modifier, often near equal parts.",
      "Collins / Fizz":
        "A sour made longer with soda, where dilution and carbonation become structural.",
      Punch:
        "Core, citrus, sweetness, water and seasoning scaled into a broader format.",
    }[f] || ""
  );
}
function openDrawer() {
  state.returnFocus = document.activeElement;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("show");
  $("#drawerBody").innerHTML =
    `<nav aria-label="All areas">${NAV.map(([id, l]) => `<button class="tool-btn" data-nav="${id}">${l}</button>`).join("")}</nav>${[
      ["surprise", "Surprise Me"],
      ["swap", "Swap Lab"],
      ["ingredients", "Ingredients"],
      ["export-data", "Export Shakerrr Data"],
      ["import-data", "Import Shakerrr Data"],
    ]
      .map(
        ([a, t]) => `<button class="tool-btn" data-action="${a}">${t}</button>`,
      )
      .join(
        "",
      )}<p>Private data stays on this device. Export a backup to protect it from cleared browser storage.</p>`;
  $("#drawer button").focus();
}
function closeDrawer() {
  const open = $("#drawer").classList.contains("open");
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("show");
  if (open) state.returnFocus?.focus();
}
function modal(title, body) {
  state.returnFocus = document.activeElement;
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modal").classList.add("show");
  $("#modal").setAttribute("aria-hidden", "false");
  $("#modal button").focus();
}
function closeModal() {
  const open = $("#modal").classList.contains("show");
  $("#modal").classList.remove("show");
  $("#modal").setAttribute("aria-hidden", "true");
  if (open) state.returnFocus?.focus();
}
async function action(name, el, e) {
  if (name === "export-data") {
    await exportShakerrr();
    return;
  }
  if (name === "import-data") {
    chooseImport();
    return;
  }
  if (name === "bar-filter") {
    renderBarResults(Number(el.dataset.count));
    return;
  }
  if (name === "region-filter") {
    state.region = el.dataset.region;
    renderAtlas();
    return;
  }
  if (name === "family-preset") {
    const t = FAMILY_TEMPLATES[el.dataset.familyName];
    $("[data-family-control]").forEach(
      (x) => (x.value = t[x.dataset.familyControl]),
    );
    updateFamily();
    return;
  }

  if (name === "close-drawer") {
    closeDrawer();
    return;
  }
  if (name === "open-drawer") {
    openDrawer();
    return;
  }
  if (name === "close-modal") {
    closeModal();
    return;
  }
  if (name === "filter") {
    state.filter = el.dataset.filter;
    renderCocktails();
    return;
  }
  if (name === "fav") {
    e.stopPropagation();
    const id = el.dataset.id;
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    localStorage.setItem("shakerrr_favs", JSON.stringify([...state.favs]));
    el.textContent = state.favs.has(id) ? "♥" : "♡";
    return;
  }
  if (name === "surprise") {
    closeDrawer();
    const r = state.recipes[Math.floor(Math.random() * state.recipes.length)];
    openRecipe(r.id);
    return;
  }
  if (name === "book-back") {
    state.book = null;
    renderBooks();
    return;
  }
  if (name === "family-filter") {
    state.filter = el.dataset.family;
    go("cocktails");
    return;
  }
  if (name === "save-my-recipe") {
    try {
      if (save("shakerrr_my_" + state.current, await readSpec()))
        el.textContent = "Saved";
    } catch (e) {
      alert(e.message);
    }
    return;
  }
  if (name === "save-social") {
    await saveSocial();
    return;
  }
  if (name === "upload-photo") {
    state.pendingPhotoId = el.dataset.id;
    $("#photoUpload").value = "";
    $("#photoUpload").click();
    return;
  }
  if (name === "use-system-photo") {
    state.photoMode[el.dataset.id] = "system";
    savePhotoModes();
    renderDetail(el.dataset.id);
    return;
  }
  if (name === "use-my-photo") {
    const blob = await getCustomPhoto(el.dataset.id);
    if (!blob) {
      state.pendingPhotoId = el.dataset.id;
      $("#photoUpload").click();
    } else {
      state.photoMode[el.dataset.id] = "custom";
      savePhotoModes();
      renderDetail(el.dataset.id);
    }
    return;
  }
  if (name === "remove-my-photo") {
    await deleteCustomPhoto(el.dataset.id);
    state.photoMode[el.dataset.id] = "system";
    savePhotoModes();
    renderDetail(el.dataset.id);
    return;
  }
  if (name === "refresh-photo") {
    state.images = (
      await fetch("data/image-manifest.json", { cache: "reload" }).then((r) =>
        r.json(),
      )
    ).byRecipe;
    state.photoMode[el.dataset.id] = "system";
    savePhotoModes();
    renderDetail(el.dataset.id);
    return;
  }
  if (name === "amaro-recipes") {
    const n = el.dataset.amaro,
      a = state.recipes.filter((r) =>
        r.ingredients?.some((i) =>
          i.name.toLowerCase().includes(n.toLowerCase().replace("amaro ", "")),
        ),
      );
    modal(n, `<div class="cards">${a.map(card).join("")}</div>`);
    hydratePhotos($("#modalBody"));
    return;
  }
  if (name === "swap") {
    closeDrawer();
    openSwap();
    return;
  }
  if (name === "ingredients") {
    closeDrawer();
    openIngredients();
    return;
  }
}
function openSwap() {
  const m = new Map();
  state.recipes.forEach((r) =>
    (r.ingredients || []).forEach((i) => {
      if (!isGarnish(i.name)) m.set(canon(i.name), i.name);
    }),
  );
  const a = [...m.entries()].sort((x, y) => x[1].localeCompare(y[1]));
  modal(
    "Swap Lab",
    `<div class="form-grid"><div class="field"><label>Replace</label><select id="swapFrom" class="form-control"><option value="">Choose ingredient…</option>${a.map(([k, n]) => `<option value="${attr(k)}">${esc(n)}</option>`).join("")}</select></div><div class="field"><label>With</label><input id="swapTo" class="form-control" placeholder="Aperol, bourbon, lemon…"></div></div><div id="swapOutput" class="method-box" style="margin-top:12px">Choose an ingredient.</div>`,
  );
  $("#swapFrom").addEventListener("change", calcSwap);
  $("#swapTo").addEventListener("input", calcSwap);
}
function calcSwap() {
  const f = $("#swapFrom").value,
    to = $("#swapTo").value.trim(),
    a = state.recipes.filter((r) =>
      r.ingredients?.some((i) => canon(i.name) === f),
    );
  $("#swapOutput").innerHTML = f
    ? `<b>${a.length} affected recipes</b>${a
        .slice(0, 35)
        .map(
          (r) =>
            `<button class="country-drink" data-recipe="${r.id}">${esc(r.name)}</button>`,
        )
        .join(
          "",
        )}${to ? `<p>Replacing with <strong>${esc(to)}</strong> changes every listed recipe. Shakerrr keeps this as an explicit variation rather than silently rewriting the original spec.</p>` : ""}`
    : "Choose an ingredient.";
}
function openIngredients() {
  const m = new Map();
  state.recipes.forEach((r) =>
    (r.ingredients || []).forEach((i) => {
      if (!isGarnish(i.name)) {
        const k = canon(i.name);
        if (k) m.set(k, { name: i.name, count: (m.get(k)?.count || 0) + 1 });
      }
    }),
  );
  const a = [...m.values()].sort((x, y) => y.count - x.count);
  modal(
    "Ingredients",
    `<div class="simple-grid">${a
      .slice(0, 180)
      .map(
        (x) =>
          `<button class="collection" data-action="ingredient-recipes" data-ingredient="${attr(canon(x.name))}"><b>${x.count}</b><h3>${esc(x.name)}</h3></button>`,
      )
      .join("")}</div>`,
  );
  $$('[data-action="ingredient-recipes"]', $("#modalBody")).forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.ingredient,
        rr = state.recipes.filter((r) =>
          r.ingredients?.some((i) => canon(i.name) === k),
        );
      $("#modalBody").innerHTML =
        `<button class="back" data-action="ingredients">← Ingredients</button><div class="cards">${rr.map(card).join("")}</div>`;
      hydratePhotos($("#modalBody"));
    }),
  );
}
async function saveSocial() {
  try {
    const spec = await readSpec();
    for (const n of ["Platform", "Creator", "Url", "Date"])
      spec[n.toLowerCase()] = $("#social" + n).value.trim();
    if (spec.url && !validURL(spec.url))
      throw Error("Use an http or https source URL");
    spec.type = "Social";
    const key = "shakerrr_social_" + state.current,
      a = readJSON(key, []);
    a.push(spec);
    if (save(key, a)) {
      state.versionIndex =
        allVersions(state.byId.get(state.current)).length - 2;
      renderVersions(state.byId.get(state.current));
    }
  } catch (e) {
    alert(e.message);
  }
}
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
async function compressImage(file) {
  const data = await fileToDataURL(file),
    im = new Image();
  await new Promise((res, rej) => {
    im.onload = res;
    im.onerror = rej;
    im.src = data;
  });
  const max = 900,
    scale = Math.min(1, max / Math.max(im.width, im.height)),
    c = document.createElement("canvas");
  c.width = Math.round(im.width * scale);
  c.height = Math.round(im.height * scale);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}
function savePhotoModes() {
  localStorage.setItem("shakerrr_photo_mode", JSON.stringify(state.photoMode));
}
async function handlePhotoUpload(e) {
  const file = e.target.files[0],
    id = state.pendingPhotoId;
  if (!file || !id) return;
  await putCustomPhoto(id, file);
  state.photoMode[id] = "custom";
  savePhotoModes();
  state.pendingPhotoId = null;
  if (state.current === id) renderDetail(id);
  else renderPage();
}
function openDB() {
  return new Promise((res, rej) => {
    const q = indexedDB.open("shakerrr-db", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("photos");
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function putCustomPhoto(id, file) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put(file, id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function getCustomPhoto(id) {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const q = db.transaction("photos").objectStore("photos").get(id);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => rej(q.error);
    });
  } catch (e) {
    return null;
  }
}
async function deleteCustomPhoto(id) {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").delete(id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {}
}

function normName(n) {
  return normalize(n);
}
function regionFor(c) {
  return REGION_BY_COUNTRY[c] || "";
}
async function loadPhoto(id, img) {
  const r = state.byId.get(id);
  if (!r || !img.isConnected) return;
  const host = img.closest(".card-photo,.detail-photo,.hero-media"),
    status = host?.querySelector(".photo-status");
  let entry = state.images[id]?.candidates?.find((x) => x.available && x.path),
    url = entry?.path,
    credit = entry
      ? `${entry.source}${entry.page ? " · p. " + entry.page : ""}`
      : "";
  if (host?.classList.contains("detail-photo")) {
    const v = allVersions(r)[state.versionIndex || 0];
    if (v?.image) {
      const candidate = state.images[id]?.candidates?.find(
        (x) => x.path === v.image && x.available,
      );
      if (candidate) {
        url = candidate.path;
        credit = `${candidate.source}${candidate.page ? " · p. " + candidate.page : ""}`;
      }
    }
  }
  if (state.photoMode[id] === "custom") {
    const photo = await getCustomPhoto(id);
    if (photo) {
      url = URL.createObjectURL(photo);
      credit = "Your photo";
    }
  }
  if (!img.isConnected) return;
  img.onload = () => {
    if (status) status.textContent = "";
    img.hidden = false;
  };
  img.onerror = () => {
    img.hidden = true;
    if (status) status.textContent = "Photograph unavailable";
  };
  if (url) {
    img.src = url;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
    if (status) status.textContent = "No verified photograph";
  }
  const c = host?.querySelector(".photo-credit");
  if (c) c.textContent = credit;
}
function recipeForm(v, social = false) {
  return `<div class="form-grid">${social ? ["Platform", "Creator", "Url", "Date"].map((n) => `<div class="field"><label for="social${n}">${n === "Url" ? "Original URL" : n}</label><input id="social${n}" class="form-control" ${n === "Date" ? 'type="date"' : ""}></div>`).join("") : ""}<div class="field full"><label for="specIngredients">Ingredients: one quantity | ingredient per line</label><textarea id="specIngredients">${esc((v.ingredients || []).map((i) => `${i.amount} | ${i.name}`).join("\n"))}</textarea></div>${["instructions", "garnish", "glass", "ice", "note"].map((n) => `<div class="field full"><label for="spec-${n}">${{ instructions: "Preparation method", note: "Notes" }[n] || n}</label><textarea id="spec-${n}">${esc(v[n] || "")}</textarea></div>`).join("")}<div class="field full"><label for="specPhoto">Version photograph</label><input id="specPhoto" type="file" accept="image/png,image/jpeg,image/webp"></div></div><button class="mini-btn" data-action="${social ? "save-social" : "save-my-recipe"}">${social ? "Save social version" : "Save my recipe"}</button>`;
}
async function readSpec() {
  const ingredients = $("#specIngredients")
    .value.split("\n")
    .filter((x) => x.trim())
    .map((x) => {
      const p = x.indexOf("|");
      if (p < 0) throw Error("Use quantity | ingredient on each line");
      return { amount: x.slice(0, p).trim(), name: x.slice(p + 1).trim() };
    });
  if (!ingredients.length || ingredients.some((i) => !i.name))
    throw Error("Add valid ingredients");
  const spec = { ingredients, updatedAt: new Date().toISOString() };
  for (const n of ["instructions", "garnish", "glass", "ice", "note"])
    spec[n] = $("#spec-" + n).value.trim();
  if (!spec.instructions) throw Error("Add a preparation method");
  const file = $("#specPhoto").files[0];
  if (file) spec.photo = await compressImage(file);
  return spec;
}
function barMatches() {
  return state.recipes
    .map((r) => ({ r, miss: missing(r.ingredients, state.bar) }))
    .sort(
      (a, b) =>
        a.miss.length - b.miss.length || a.r.name.localeCompare(b.r.name),
    );
}
function renderBarResults(n) {
  state.barFilter = n;
  const a = barMatches().filter((x) => x.miss.length === n);
  $("#barResults").innerHTML =
    `<h2>${n === 0 ? "Make Now" : n === 1 ? "Missing One" : "Missing Two"}</h2><div class="cards">${
      a
        .slice(0, 60)
        .map(
          (x) =>
            `<div>${x.miss.length ? `<p>Missing: ${esc(x.miss.join(", "))}</p>` : ""}${card(x.r)}</div>`,
        )
        .join("") || "<p>No matching cocktails with this inventory.</p>"
    }</div>`;
  hydratePhotos();
}
async function exportShakerrr() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (allowedKey(k)) storage[k] = localStorage.getItem(k);
  }
  const db = await openDB();
  const rows = await new Promise((res, rej) => {
    const tx = db.transaction("photos"),
      s = tx.objectStore("photos"),
      keys = s.getAllKeys(),
      values = s.getAll();
    tx.oncomplete = () => res(keys.result.map((k, i) => [k, values.result[i]]));
    tx.onerror = () => rej(tx.error);
  });
  const photos = {};
  for (const [k, v] of rows) photos[k] = await fileToDataURL(v);
  const blob = new Blob(
      [
        JSON.stringify({
          format: "shakerrr-backup",
          version: 3,
          exportedAt: new Date().toISOString(),
          storage,
          photos,
        }),
      ],
      { type: "application/json" },
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "shakerrr-backup-v3.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importShakerrr(file) {
  const p = validateBackup(JSON.parse(await file.text())),
    before = {};
  for (const k of Object.keys(p.storage))
    if (allowedKey(k)) before[k] = localStorage.getItem(k);
  const photos = [];
  for (const [id, data] of Object.entries(p.photos || {}))
    photos.push([id, await fetch(data).then((r) => r.blob())]);
  try {
    for (const [k, v] of Object.entries(p.storage)) {
      if (!allowedKey(k)) continue;
      if (/_(favs|bar)$/.test(k))
        localStorage.setItem(
          k,
          JSON.stringify([...new Set([...readJSON(k, []), ...JSON.parse(v)])]),
        );
      else localStorage.setItem(k, v);
    }
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction("photos", "readwrite");
      for (const [id, blob] of photos) tx.objectStore("photos").put(blob, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } catch (e) {
    for (const [k, v] of Object.entries(before))
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    throw e;
  }
  location.reload();
}
function chooseImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    if (input.files[0])
      try {
        await importShakerrr(input.files[0]);
      } catch (e) {
        alert("Backup not imported: " + e.message);
      }
  };
  input.click();
}
document.addEventListener("keydown", (e) => {
  const root = $("#modal.show") || $("#drawer.open");
  if (e.key === "Escape") {
    closeModal();
    closeDrawer();
    closeSearch();
  }
  if (root && e.key === "Tab") {
    const items = $$(
        'button,input,select,textarea,a[href],[tabindex="0"]',
        root,
      ).filter((x) => x.offsetParent !== null),
      first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
boot();
