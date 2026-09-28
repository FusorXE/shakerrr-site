export function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const concepts = [
  ["gin", "Spirit", /\bgin\b|\bbeefeater\b/],
  ["bourbon", "Whiskey", /\bbourbon\b|\bwathens\b/],
  ["rye whiskey", "Whiskey", /\brye\b/],
  ["scotch", "Whiskey", /\bscotch\b|\blaphroaig\b|\blagavulin\b/],
  ["whiskey", "Spirit", /\bwhisk[ey]+\b/],
  ["tequila reposado", "Agave", /\breposado\b.*tequila|tequila.*reposado/],
  ["tequila añejo", "Agave", /\banejo\b.*tequila|tequila.*anejo/],
  [
    "tequila blanco",
    "Agave",
    /(blanco|silver).*tequila|tequila.*(blanco|silver)/,
  ],
  ["tequila", "Agave", /tequila/],
  ["mezcal", "Agave", /mezcal/],
  ["overproof rum", "Rum", /(overproof|151).*rum|rum.*(overproof|151)/],
  [
    "white rum",
    "Rum",
    /(white|light|blanc|silver).*rum|rum.*(white|light|blanc|silver)/,
  ],
  ["aged rum", "Rum", /(aged|gold|anejo).*rum|rum.*(aged|gold|anejo)/],
  ["dark rum", "Rum", /(dark|blackstrap|coruba).*rum|rum.*dark/],
  ["rum", "Spirit", /\brum\b/],
  [
    "sweet vermouth",
    "Fortified wine",
    /(sweet|rosso|carpano antica).*vermouth|vermouth.*(sweet|rosso)/,
  ],
  ["dry vermouth", "Fortified wine", /dry.*vermouth|vermouth.*dry/],
  [
    "blanc vermouth",
    "Fortified wine",
    /(blanc|bianco).*vermouth|vermouth.*(blanc|bianco)/,
  ],
  ["lime juice", "Citrus", /lime.*juice/],
  ["lemon juice", "Citrus", /lemon.*juice/],
  ["grapefruit juice", "Citrus", /grapefruit.*juice/],
  ["orange juice", "Citrus", /orange.*juice/],
  ["pineapple juice", "Juice", /pineapple.*juice/],
  ["rich simple syrup", "Syrup", /rich.*simple syrup|2 1.*simple syrup/],
  ["demerara syrup", "Syrup", /demerara.*syrup/],
  ["simple syrup", "Syrup", /simple syrup|sugar syrup/],
  ["soda water", "Lengthener", /club soda|soda water|sparkling water/],
  ...[
    "Campari",
    "Aperol",
    "Cynar",
    "Averna",
    "Amaro Nonino",
    "Fernet-Branca",
    "Bénédictine",
    "Yellow Chartreuse",
    "Green Chartreuse",
    "Cointreau",
    "Luxardo Maraschino",
    "Angostura bitters",
    "Peychaud’s bitters",
    "Orange bitters",
  ].map((n) => [
    n.toLowerCase(),
    /bitters/i.test(n)
      ? "Bitters"
      : /Campari|Aperol|Cynar|Averna|Amaro|Fernet/.test(n)
        ? "Amaro / aperitivo"
        : "Liqueur",
    new RegExp(normalize(n).replace("luxardo ", "").replace("amaro ", "")),
  ]),
];
export function ingredient(name = "") {
  const text = normalize(name),
    hit = concepts.find((c) => c[2].test(text));
  return {
    id: normalize(hit?.[0] || text),
    name: hit?.[0] || name.trim(),
    category: hit?.[1] || "Ingredient",
    wording: name,
  };
}
export function garnish(i) {
  const s = typeof i === "string" ? i : i.name;
  return (
    (typeof i === "object" && (i.optional || i.role === "garnish")) ||
    /\b(for garnish|for the rim|garnish|ice cubes|crushed ice|pebble ice)\b/i.test(
      s,
    ) ||
    /^ice$/i.test(s)
  );
}
export function matches(required, inventory) {
  const id = ingredient(required).id;
  if (inventory.has(id)) return true;
  const equivalents = {
    gin: [],
    whiskey: ["bourbon", "rye whiskey", "scotch"],
    tequila: ["tequila blanco", "tequila reposado", "tequila anejo"],
    rum: ["white rum", "aged rum", "dark rum", "overproof rum"],
  };
  return (equivalents[id] || []).some((x) => inventory.has(x));
}
export function missing(ingredients, inventory) {
  return [
    ...new Set(
      ingredients.filter((i) => !garnish(i)).map((i) => ingredient(i.name).id),
    ),
  ].filter((id) => !matches(id, inventory));
}
export function amount(value, unit) {
  const s = String(value || "");
  const m = s.match(
    /^([\d\s./¼½¾⅛⅜⅝⅞⅓⅔]+)\s*(oz|ounces?|ml|milliliters?)\b(.*)$/i,
  );
  if (!m) return s;
  const f = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
  };
  let n = 0;
  const num = m[1].trim().replace(/[¼½¾⅛⅜⅝⅞⅓⅔]/g, (c) => " " + f[c]);
  for (const part of num.split(/\s+/)) {
    if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      n += a / b;
    } else n += Number(part);
  }
  if (!Number.isFinite(n)) return s;
  const from = /^(oz|ounce)/i.test(m[2]) ? "oz" : "ml";
  if (from === unit) return s;
  const converted = unit === "ml" ? n * 29.5735295625 : n / 29.5735295625;
  return `${Number(converted.toFixed(unit === "ml" ? 1 : 2))} ${unit}${m[3]}`;
}
export function searchText(r) {
  return normalize(
    [
      r.name,
      ...(r.aliases || []),
      r.category,
      r.country,
      r.region,
      r.family,
      ...(r.tags || []),
      ...(r.collections || []),
      ...Object.values(r.movie || {}),
      ...(r.versions || []).flatMap((v) => [
        v.label,
        v.creator,
        v.note,
        ...v.ingredients.flatMap((i) => [i.name, ingredient(i.name).id]),
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}
