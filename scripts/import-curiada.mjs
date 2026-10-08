import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectWebP } from './validate-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalizedName = (name) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function recipeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'curiada.com' ||
      !/^\/blogs\/cocktail-library\/[a-z0-9-]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Expected one explicit canonical Curiada recipe URL');
  }
  return url.href;
}

export function imageUrl(value, sourceUrl) {
  const url = new URL(value, sourceUrl);
  if (url.protocol !== 'https:' || !['curiada.com', 'cdn.shopify.com'].includes(url.hostname) ||
      !/\/(?:cdn\/shop\/articles|s\/files)\//.test(url.pathname)) {
    throw new Error('Expected the named article image on Curiada or Shopify');
  }
  return url.href;
}

export function extractRecipe(html, entry) {
  const objects = [];
  function visit(value) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if ([value['@type']].flat().includes('Recipe')) objects.push(value);
      if (value['@graph']) visit(value['@graph']);
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Unrelated malformed schema is not a recipe. */ }
  }
  const found = objects.filter((item) => item.url === entry.url && item.name === entry.expectedName);
  if (found.length !== 1) throw new Error(`Expected one exact named Recipe schema for ${entry.url}`);
  const source = found[0];
  const ingredients = source.recipeIngredient;
  const directions = source.recipeInstructions?.map((step) => typeof step === 'string' ? step : step.text);
  if (!Array.isArray(ingredients) || !ingredients.length || ingredients.some((line) => typeof line !== 'string' || !line.trim()) ||
      !Array.isArray(directions) || !directions.length || directions.some((line) => typeof line !== 'string' || !line.trim())) {
    throw new Error(`Incomplete ingredients or directions for ${entry.expectedName}`);
  }
  const image = [source.image].flat()[0];
  const facts = {
    name: source.name, url: recipeUrl(source.url),
    image: imageUrl(typeof image === 'string' ? image : image?.url, entry.url),
    published: source.datePublished, ingredients, directions,
  };
  if (digest(facts) !== entry.sourceFingerprint) throw new Error(`Source changed: review ${entry.expectedName} before importing`);
  const { directions: _directions, ...snapshot } = facts;
  return snapshot;
}

export function parseIngredient(line) {
  // Retain unrecognized lines intact: no ingredient or quantity is guessed away.
  const top = line.match(/^Top up with\s+(.+)$/i);
  if (top) return { amount: 'To top', name: top[1] };
  const match = line.match(/^([\d./¼½¾⅓⅔⅛⅜⅝⅞]+(?:\s+(?:fl oz|oz|ml|cl|dash(?:es)?|tsp|tbsp|slice(?:s)?|fresh))?)\s+(.+)$/i);
  return match ? { amount: match[1], name: match[2] } : { amount: '', name: line };
}

function validateEntry(entry) {
  recipeUrl(entry.url);
  if (!/^[a-z0-9-]+$/.test(entry.id) || !/^[a-f0-9]{64}$/.test(entry.sourceFingerprint) ||
      !entry.expectedName || !entry.instructions?.trim() || !entry.reviewed || !entry.method) {
    throw new Error('Batch entries need a safe id, source fingerprint and reviewed preparation');
  }
  const snapshot = entry.snapshot;
  if (snapshot.name !== entry.expectedName || snapshot.url !== entry.url || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.published) ||
      !Array.isArray(snapshot.ingredients) || !snapshot.ingredients.length || snapshot.ingredients.some((line) => typeof line !== 'string' || !line.trim())) {
    throw new Error(`Invalid reviewed snapshot: ${entry.id}`);
  }
  imageUrl(snapshot.image, entry.url);
}

export function mergeBatch(recipes, manifest, prepared) {
  const nextRecipes = structuredClone(recipes);
  const nextManifest = structuredClone(manifest);
  const report = [];
  for (const { entry, facts, asset, imageInfo } of prepared) {
    validateEntry(entry);
    let recipe = nextRecipes.find((item) => normalizedName(item.name) === normalizedName(entry.expectedName));
    if (recipe && recipe.id !== entry.id) throw new Error(`Existing canonical name uses ${recipe.id}; explicitly map it before importing ${entry.id}`);
    if (!recipe && nextRecipes.some((item) => item.id === entry.id)) throw new Error(`Canonical id collision: ${entry.id}`);
    const ingredients = facts.ingredients.map(parseIngredient);
    const note = `Published in Curiada's Cocktail Library on ${facts.published}.`;
    const version = {
      label: 'Curiada', key: 'curiada', type: 'Published Reference', ingredients,
      instructions: entry.instructions, note, creator: '', usable: true,
      garnish: entry.garnish, glass: entry.glass, image: asset,
      url: entry.url, sourceUrl: entry.url, published: facts.published,
    };
    const added = !recipe;
    if (!recipe) {
      recipe = {
        id: entry.id, name: entry.expectedName, category: 'Modern', country: null,
        method: entry.method, family: entry.family, tags: ['curiada', ...entry.tags],
        versions: [], image: asset, movie: null, collections: ['Curiada'],
        ingredients, instructions: entry.instructions, note, quality: 'verified',
        garnish: entry.garnish, glass: entry.glass,
      };
      nextRecipes.push(recipe);
    }
    // Do not replace existing canonical specs, history, or curated source versions.
    const hasVersion = recipe.versions.some((item) => (item.sourceUrl || item.url) === entry.url);
    if (!hasVersion) recipe.versions.push(version);
    if (!recipe.collections.includes('Curiada')) recipe.collections.push('Curiada');
    const imageEntry = nextManifest.byRecipe[recipe.id] ||= { name: recipe.name, candidates: [] };
    const candidate = imageEntry.candidates.find((item) => item.path === asset);
    if (candidate && candidate.sha256 !== imageInfo.sha256) throw new Error(`Existing image changed: ${asset}`);
    if (!candidate) imageEntry.candidates.push({
      id: recipe.id, source: 'Curiada', path: asset, available: true, status: 'verified-external',
      sourceUrl: entry.url, sourceImageUrl: facts.image, sourceImageRecipe: entry.expectedName,
      evidence: `Named article Recipe schema identifies ${entry.expectedName} and this image; recipe facts reviewed ${entry.reviewed}.`,
      ...imageInfo,
    });
    report.push({ id: recipe.id, action: added ? 'added' : hasVersion ? 'unchanged' : 'source-version-added', sourceUrl: entry.url, image: asset });
  }
  return { recipes: nextRecipes, manifest: nextManifest, report };
}

async function download(url, kind) {
  const response = await fetch(url, {
    redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Accept: kind === 'image' ? 'image/webp' : 'text/html', 'User-Agent': 'Shakerrr-Reviewed-Recipe-Importer/1.0' },
  });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes(kind === 'image' ? 'image/webp' : 'text/html')) throw new Error(`Unexpected content type from ${url}: ${type}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 3_000_000) throw new Error(`Response too large: ${url}`);
  return kind === 'image' ? bytes : bytes.toString('utf8');
}

export async function importCuriada({ root = ROOT, apply = false, offline = false } = {}) {
  const batch = json(path.join(root, 'source-data/curiada/reviewed-batch.json'));
  if (!Array.isArray(batch.items) || !batch.items.length || batch.items.length > 10) throw new Error('Select a batch of 1–10 reviewed recipes');
  const ids = new Set();
  const prepared = [];
  for (const entry of batch.items) {
    validateEntry(entry);
    if (ids.has(entry.id)) throw new Error(`Duplicate batch id: ${entry.id}`);
    ids.add(entry.id);
    const facts = offline ? entry.snapshot : extractRecipe(await download(entry.url, 'html'), entry);
    const asset = `assets/recipes/${entry.id}-curiada.webp`;
    const file = path.join(root, asset);
    let bytes;
    if (fs.existsSync(file)) bytes = fs.readFileSync(file);
    else {
      if (offline) throw new Error(`Offline import needs committed image: ${asset}`);
      const url = new URL(facts.image);
      url.searchParams.set('format', 'webp');
      bytes = await download(url.href, 'image');
    }
    const imageInfo = inspectWebP(bytes);
    if (imageInfo.width < 100 || imageInfo.height < 100) throw new Error(`Image too small: ${asset}`);
    prepared.push({ entry, facts, asset, bytes, imageInfo });
  }
  const result = mergeBatch(json(path.join(root, 'data/recipes.json')), json(path.join(root, 'data/image-manifest.json')), prepared);
  // All source pages, names, fingerprints and image containers pass before any write.
  if (apply) {
    for (const { asset, bytes } of prepared) {
      const file = path.join(root, asset);
      if (!fs.existsSync(file)) fs.writeFileSync(file, bytes, { flag: 'wx' });
    }
    for (const [file, value] of [['data/recipes.json', result.recipes], ['data/image-manifest.json', result.manifest]]) {
      const target = path.join(root, file);
      fs.writeFileSync(`${target}.curiada-tmp`, JSON.stringify(value, null, 2) + '\n');
      fs.renameSync(`${target}.curiada-tmp`, target);
    }
    fs.writeFileSync(path.join(root, 'source-data/curiada/import-report.json'), JSON.stringify({ checked: batch.items[0].reviewed, recipes: result.report }, null, 2) + '\n');
  }
  return result.report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => !['--apply', '--offline'].includes(flag))) throw new Error('Usage: node scripts/import-curiada.mjs [--apply] [--offline]');
  const report = await importCuriada({ apply: flags.includes('--apply'), offline: flags.includes('--offline') });
  console.log(JSON.stringify({ mode: flags.includes('--apply') ? 'applied' : 'preview', recipes: report }, null, 2));
}
