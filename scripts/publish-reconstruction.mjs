import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inspectWebP } from './validate-images.mjs';

const root = process.cwd();
const recipesPath = path.join(root, 'data/recipes.json');
const manifestPath = path.join(root, 'data/image-manifest.json');
const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function inspectAsset(assetPath) {
  const absolute = path.join(root, assetPath);
  if (!fs.existsSync(absolute)) throw new Error(`Missing image ${assetPath}`);
  const bytes = fs.readFileSync(absolute);
  const inspected = inspectWebP(bytes);
  if (inspected.width < 250 || inspected.height < 250) throw new Error(`Image is too small: ${assetPath}`);
  return {
    width: inspected.width,
    height: inspected.height,
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function setCandidate(recipe, candidate) {
  manifest.byRecipe[recipe.id] ||= { name: recipe.name, candidates: [] };
  manifest.byRecipe[recipe.id].name = recipe.name;
  manifest.byRecipe[recipe.id].candidates ||= [];
  manifest.byRecipe[recipe.id].candidates = manifest.byRecipe[recipe.id].candidates.filter(
    (existing) => existing.path !== candidate.path && existing.status !== 'recipe-matched',
  );
  manifest.byRecipe[recipe.id].candidates.push(candidate);
}

// Angie’s Secret: stop using a visual substitute. Use a photograph attached to an exact named-drink page.
const angie = recipes.find((r) => r.id === 'angies-secret');
if (!angie) throw new Error('Missing canonical recipe angies-secret');
const angiePath = 'assets/recipes/angies-secret-exact.webp';
const angieMeta = inspectAsset(angiePath);
angie.image = angiePath;
angie.creator = angie.creator || 'Jillian Vose';
const angieDeathCo = (angie.versions || []).find((v) => /death\s*&\s*co/i.test(v.label || ''));
if (angieDeathCo) {
  angieDeathCo.image = angiePath;
  angieDeathCo.creator = angieDeathCo.creator || 'Jillian Vose';
}
setCandidate(angie, {
  id: angie.id,
  source: 'Mr. Cock & Tails',
  sourceUrl: 'https://mrcockandtails.com/2023/07/24/angies-secret/',
  evidence: 'Exact named-drink page for Angie’s Secret. The page credits Jillian Vose, 2011, Death & Company and illustrates the prepared cocktail. MJ also independently supplied a public 2015 The Cabinet Bar post explicitly naming Angie’s Secret by Jillian Vose with the matching rum, Becherovka, cane-syrup and mole-bitters build.',
  path: angiePath,
  available: true,
  status: 'verified-external',
  ...angieMeta,
});

// Add the contemporary published Elderflower Samba Martini if it is not already canonical.
const sambaPath = 'assets/recipes/elderflower-samba-martini-curiada.webp';
const sambaMeta = inspectAsset(sambaPath);
const sambaVersion = {
  label: 'Curiada',
  key: 'curiada',
  type: 'Published Reference',
  ingredients: [
    { amount: '2 oz', name: 'Novo Fogo Chameleon Cachaça' },
    { amount: '½ oz', name: 'St-Germain Elderflower Liqueur' },
    { amount: '1½ oz', name: 'Pressed Apple Juice' },
    { amount: '½ oz', name: 'Fresh Lime Juice' },
  ],
  instructions: 'Add ice and all ingredients to a shaker. Shake vigorously, then fine strain into a chilled martini glass.',
  note: 'Curiada published this recipe on December 16, 2025, presenting it as a bright modern martini variation pairing Brazilian cachaça with elderflower, apple and lime. A separate web check did not establish an earlier named creator or historical origin for this exact drink, so Shakerrr records it as a contemporary published recipe rather than inventing a backstory.',
  creator: '',
  usable: true,
  garnish: 'Apple slice and mint sprig',
  glass: 'Martini glass',
  ice: 'Shaken with ice; served up',
  image: sambaPath,
  url: 'https://curiada.com/blogs/cocktail-library/elderflower-samba-martini',
  sourceUrl: 'https://curiada.com/blogs/cocktail-library/elderflower-samba-martini',
  published: '2025-12-16',
};
let samba = recipes.find((r) => r.id === 'elderflower-samba-martini');
if (!samba) {
  samba = {
    id: 'elderflower-samba-martini',
    name: 'Elderflower Samba Martini',
    category: 'Modern',
    country: 'Brazil',
    method: 'Shake',
    family: 'Sour',
    tags: ['modern', 'international', 'brazil', 'cachaça', 'elderflower', 'floral'],
    versions: [sambaVersion],
    image: sambaPath,
    movie: null,
    collections: ['Curiada'],
    ingredients: sambaVersion.ingredients,
    instructions: sambaVersion.instructions,
    note: sambaVersion.note,
    quality: 'verified',
    garnish: sambaVersion.garnish,
    glass: sambaVersion.glass,
    ice: sambaVersion.ice,
  };
  const insertAt = recipes.findIndex((r) => r.id.localeCompare(samba.id) > 0);
  if (insertAt === -1) recipes.push(samba);
  else recipes.splice(insertAt, 0, samba);
} else {
  Object.assign(samba, {
    category: samba.category || 'Modern',
    country: samba.country || 'Brazil',
    method: 'Shake',
    family: samba.family || 'Sour',
    image: sambaPath,
    ingredients: sambaVersion.ingredients,
    instructions: sambaVersion.instructions,
    note: sambaVersion.note,
    quality: 'verified',
    garnish: sambaVersion.garnish,
    glass: sambaVersion.glass,
    ice: sambaVersion.ice,
  });
  samba.tags = [...new Set([...(samba.tags || []), 'modern', 'international', 'brazil', 'cachaça', 'elderflower', 'floral'])];
  samba.collections = [...new Set([...(samba.collections || []), 'Curiada'])];
  const otherVersions = (samba.versions || []).filter((v) => v.key !== 'curiada');
  samba.versions = [sambaVersion, ...otherVersions];
}
setCandidate(samba, {
  id: samba.id,
  source: 'Curiada',
  sourceUrl: 'https://curiada.com/blogs/cocktail-library/elderflower-samba-martini',
  evidence: 'Curiada’s named Elderflower Samba Martini recipe page, published December 16, 2025, includes the finished-drink photograph and exact four-ingredient build.',
  path: sambaPath,
  available: true,
  status: 'verified-external',
  ...sambaMeta,
});

manifest.generated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  angiesSecret: { path: angiePath, ...angieMeta },
  elderflowerSambaMartini: { path: sambaPath, ...sambaMeta },
  skippedUnverifiedFinalTen: true,
}, null, 2));
