#!/usr/bin/env node
/**
 * Discover publisher-hosted image URLs for every canonical cocktail card.
 * Search the publisher page, use its actual image URL, never download photos.
 * Run: node scripts/index-publisher-photos.mjs [--limit 354] [--offset 0]
 */
import fs from "node:fs";
import { normalizeCatalog } from "../src/catalog-model.js";

const raw = JSON.parse(fs.readFileSync("data/recipes.json", "utf8"));
const recipes = normalizeCatalog(raw).recipes;
const outPath = "data/publisher-photos.json";
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
const byRecipe = { ...(existing.byRecipe || {}) };
const offset = Number(process.argv[process.argv.indexOf("--offset") + 1]) || 0;
const argLimit = Number(process.argv[process.argv.indexOf("--limit") + 1]);
const limit = Number.isFinite(argLimit) && argLimit > 0 ? Math.min(argLimit, 354) : 354;
const normalize = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/&/g, " and ").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (s) => normalize(s).replace(/\s+/g, "-");
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const clean = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const hostOk = (url) => /^https:\/\//.test(url) && !/default\/global\/ogimage|favicon|logo\b/i.test(url);
const getAttr = (tag, key) => {
  const pattern = new RegExp("\\b" + key + "\\s*=\\s*(['\"])(.*?)\\1", "i");
  return decode(tag.match(pattern)?.[2] || "");
};
function meta(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (getAttr(tag, "property") === property || getAttr(tag, "name") === property)
      return getAttr(tag, "content");
  }
  return "";
}
async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShakerrrRecipeReference/1.0; +https://github.com/FusorXE/shakerrr-site)",
                 "Accept": "text/html,application/xhtml+xml" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) return null;
    const body = await response.text();
    return body.slice(0, 1200000);
  } catch { return null; }
  finally { clearTimeout(timer); }
}
function pageTitle(html) {
  return clean(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}
function isExactTitle(wanted, title) {
  const t = normalize(title), n = normalize(wanted);
  return t === n || t === n + " cocktail" ||
    t.startsWith(n + " diffords ") || t === n + " diffords recipe" ||
    t.startsWith(n + " cocktail recipe") || t.startsWith(n + " recipe");
}
const entry = (url, sourceUrl, source, title) => ({
  candidates: [{ path: url, sourceUrl, source, title, status: "publisher-online",
                 available: true, verified: "publisher-recipe-page" }],
});
async function directSource(recipe) {
  const linked = (recipe.versions || []).map(v => v.sourceUrl || v.url).filter(Boolean);
  for (const sourceUrl of linked) {
    if (!hostOk(sourceUrl)) continue;
    const html = await fetchHtml(sourceUrl);
    if (!html) continue;
    const title = pageTitle(html);
    if (!isExactTitle(recipe.name, title)) continue;
    const image = meta(html, "og:image") || meta(html, "twitter:image");
    if (hostOk(image)) return entry(image, sourceUrl, new URL(sourceUrl).hostname, title);
  }
  return null;
}
async function iba(recipe) {
  const url = "https://iba-world.com/iba-cocktail/" + slug(recipe.name) + "/";
  const html = await fetchHtml(url);
  if (!html || !isExactTitle(recipe.name, pageTitle(html))) return null;
  const choices = [...new Set((html.match(/https:\/\/iba-world\.com\/wp-content\/uploads\/[^\s"'<>]+\.webp/g) || []).map(decode))];
  const key = slug(recipe.name).replace(/-/g, "");
  const photo = choices.find(x => normalize(x).replace(/\s/g, "").includes(key))
    || choices.find(x => /\/iba-cocktail-/i.test(x));
  if (!hostOk(photo)) return null;
  return entry(photo, url, "IBA", recipe.name);
}
function diffordResults(html) {
  const out = [];
  const pieces = html.split(/<div class="link-box link-box--cocktails[^"]*">/i).slice(1);
  for (const piece of pieces) {
    const block = piece.slice(0, 7000);
    const titleMatch = block.match(/<h3 class="link-box__title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const img = block.match(/<img\b[^>]+class="link-box__image"[^>]*>/i);
    if (!titleMatch || !img) continue;
    const sourceUrl = decode(titleMatch[1]), title = clean(titleMatch[2]), photo = getAttr(img[0], "src");
    if (sourceUrl.startsWith("https://www.diffordsguide.com/cocktails/recipe/") &&
      photo.startsWith("https://cdn.diffordsguide.com/cocktail/"))
      out.push({ title, sourceUrl, photo });
  }
  return out;
}
async function difford(recipe) {
  const url = "https://www.diffordsguide.com/cocktails/search?keyword=" + encodeURIComponent(recipe.name);
  const html = await fetchHtml(url);
  if (!html) return null;
  const hits = diffordResults(html).filter(x => isExactTitle(recipe.name, x.title));
  hits.sort((a, b) => Number(normalize(a.title) !== normalize(recipe.name)) -
                      Number(normalize(b.title) !== normalize(recipe.name)));
  for (const hit of hits.slice(0, 2)) {
    const detail = await fetchHtml(hit.sourceUrl);
    const image = detail && meta(detail, "og:image");
    const photo = hostOk(image) ? image : hit.photo;
    if (hostOk(photo)) return entry(photo, hit.sourceUrl, "Difford's Guide", hit.title);
  }
  return null;
}
async function liquor(recipe) {
  const url = "https://www.liquor.com/recipes/" + slug(recipe.name) + "/";
  const html = await fetchHtml(url);
  if (!html || !isExactTitle(recipe.name, pageTitle(html))) return null;
  const photo = meta(html, "og:image") || meta(html, "twitter:image");
  return hostOk(photo) ? entry(photo, url, "Liquor.com", recipe.name) : null;
}
async function punch(recipe) {
  // PUNCH hosts its recipes at stable name-based URLs. Only use the image
  // on a confirmed recipe page; never guess image filenames or copy files.
  const sourceUrl = "https://punchdrink.com/recipes/" + slug(recipe.name) + "/";
  const html = await fetchHtml(sourceUrl);
  if (!html || !/single-recipe|recipe-template-default/i.test(html)) return null;
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const prefix = normalize(title.split("|")[0].replace(/\s+(cocktail|aperitivo|pisco)\s+recipe$/i, "")
    .replace(/\s+recipe$/i, ""));
  const wanted = normalize(recipe.name);
  if (prefix !== wanted && prefix !== wanted + " cocktail" && prefix !== wanted + " pisco") return null;
  const photoTag = html.match(/<img\b[^>]*\bitemprop=["']image["'][^>]*>/i)?.[0];
  const photo = photoTag ? getAttr(photoTag, "src") : "";
  if (!/^https:\/\/punchdrink\.com\/wp-content\/uploads\/[^"'<>]+(?:\.jpe?g|\.webp|\.png)(?:\?[^"'<>]*)?$/i.test(photo)) return null;
  return entry(photo, sourceUrl, "PUNCH", recipe.name);
}

const work = recipes.slice(offset, offset + limit);
let active = 0, next = 0, done = 0;
const stats = { attempted: work.length, matched: 0, byPublisher: {}, errors: 0 };
async function consume() {
  while (next < work.length) {
    const recipe = work[next++];
    try {
      if (!byRecipe[recipe.id]?.candidates?.length) {
        const found = await directSource(recipe) || await iba(recipe) ||
          await punch(recipe) || await difford(recipe) || await liquor(recipe);
        if (found) {
          byRecipe[recipe.id] = found;
          stats.matched++;
          const source = found.candidates[0].source;
          stats.byPublisher[source] = (stats.byPublisher[source] || 0) + 1;
        }
      }
    } catch (e) {
      stats.errors++;
      console.warn(recipe.id, String(e));
    }
    done++;
    if (done % 25 === 0) console.log("Publisher images", done, "/", work.length, "new", stats.matched);
    // Small pause, and at most four concurrent recipe lookups.
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}
await Promise.all(Array.from({ length: Math.min(4, work.length) }, consume));
const result = {
  version: 1, generatedAt: new Date().toISOString(),
  description: "Cocktail images linked directly to verified publisher recipe pages; no photos downloaded.",
  byRecipe: Object.fromEntries(Object.entries(byRecipe).sort(([a], [b]) => a.localeCompare(b))),
  stats: { ...stats, resolved: Object.keys(byRecipe).length, catalogCards: recipes.length },
};
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
console.log("Publisher image index:", JSON.stringify(result.stats));
