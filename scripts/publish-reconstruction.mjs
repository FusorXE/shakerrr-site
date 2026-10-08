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

// Exact Angie’s Secret photograph supplied by MJ from The Cabinet Bar's public Instagram post.
const angie = recipes.find((r) => r.id === 'angies-secret');
if (!angie) throw new Error('Missing canonical recipe angies-secret');
const angiePath = 'assets/recipes/angies-secret-exact.webp';
const angieMeta = inspectAsset(angiePath);
if (
  angieMeta.width !== 600 ||
  angieMeta.height !== 598 ||
  angieMeta.bytes !== 21756 ||
  angieMeta.sha256 !== 'ec0fbc3abc02f7d916dd871ad5731d57622d898c700a5154f8393a23f2253602'
) {
  throw new Error(`Unexpected Angie’s Secret image metadata: ${JSON.stringify(angieMeta)}`);
}
angie.image = angiePath;
const angieDeathCo = (angie.versions || []).find((v) => /death\s*&\s*co/i.test(v.label || ''));
if (angieDeathCo) angieDeathCo.image = angiePath;
setCandidate(angie, {
  id: angie.id,
  source: 'The Cabinet Bar / Instagram',
  sourceUrl: 'https://www.instagram.com/thecabinetbar/',
  evidence: 'User-supplied screenshot of The Cabinet Bar public Instagram post dated October 24, 2015 explicitly names “Angie’s Secret” by Jillian Vose and shows the finished drink. The visible caption lists white agricole rum, Appleton V/X rum, Becherovka, cane sugar syrup, and Xocolatl Mole bitters.',
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
  note: 'Published by Curiada on December 16, 2025. Curiada presents this as a bright modern martini variation pairing aged Brazilian cachaça with elderflower, apple, and lime. No reliable independent source found an earlier creator or established historical origin, so Shakerrr treats it as a contemporary published recipe rather than a historical classic.',
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
  skippedRepresentativeFinalTen: true,
}, null, 2));
