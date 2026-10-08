import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { auditImages, inspectWebP } from './validate-images.mjs';

const root = process.cwd();
const recipesPath = path.join(root, 'data/recipes.json');
const manifestPath = path.join(root, 'data/image-manifest.json');
const metaPath = path.join(root, 'data/catalog-meta.json');
const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

const assignments = [
  {
    id: 'angies-secret',
    path: 'assets/recipes/death-co__classic-manhattan__p290.webp',
    source: 'Death & Co', book: '06', pdfPage: 290, printedPage: 145,
    sourceImageRecipe: 'Classic Manhattan',
    matchBasis: 'Same stirred, spirit-forward coupe presentation and deep amber-red visual profile; representative differs by showing a cherry garnish while Angie’s Secret is ungarnished.',
    evidence: 'Death & Co has no dedicated Angie’s Secret photo on its recipe page. Classic Manhattan is used explicitly as the closest honest visual representative, not as an exact photo.',
    width: 700, height: 999, bytes: 16398,
    sha256: '3dc7fa59425b021b7740ebf712bf86a2f6708842a84fa01be273cfdb22fac4cf',
  },
  {
    id: 'el-conde-de-san-dionisio',
    path: 'assets/recipes/death-co__naked-and-famous__p209.webp',
    source: 'Death & Co', book: '06', pdfPage: 209, printedPage: 185,
    sourceImageRecipe: 'Naked and Famous',
    matchBasis: 'Mezcal and Yellow Chartreuse overlap, coupe service, and pale orange agave-cocktail appearance closely match the expected presentation.',
    evidence: 'The exact El Conde de San Dionisio recipe is published without a dedicated photograph. The explicitly captioned Naked and Famous photograph is used only as a recipe-matched representative.',
    width: 395, height: 880, bytes: 8078,
    sha256: '797c217335a190f3a45f2260f1d67a931e57e86e817cba2aeaebbad99c587e73',
  },
  {
    id: 'el-embarcadero',
    path: 'assets/recipes/holy-smoke__la-otra-palabra__p158.webp',
    source: "Holy Smoke! It's Mezcal!", book: 'Holy Smoke', pdfPage: 158, printedPage: 156,
    sourceImageRecipe: 'La Otra Palabra',
    matchBasis: 'Pale citrus-agave drink over rocks in an old-fashioned glass closely matches El Embarcadero’s shaken tequila-mezcal-pineapple build; garnish differs.',
    evidence: 'Holy Smoke provides no dedicated El Embarcadero image on the recipe page. This nearby named photograph is recorded explicitly as a representative only.',
    width: 663, height: 1042, bytes: 14710,
    sha256: 'b07ce92e95c118083a73fee5221fa8cf321e2870b83c7e252e37388be2a1ebe7',
  },
  {
    id: 'mezcal-floater',
    path: 'assets/recipes/holy-smoke__mezcal-margarita__p155.webp',
    source: "Holy Smoke! It's Mezcal!", book: 'Holy Smoke', pdfPage: 155, printedPage: 153,
    sourceImageRecipe: 'Mezcal Margarita',
    matchBasis: 'Tequila-and-mezcal citrus build, rocks service, salted rim, and lime presentation closely match Mezcal Floater.',
    evidence: 'The Mezcal Floater recipe has no dedicated photograph. The same-book Mezcal Margarita image is used only as a recipe-matched representative.',
    width: 383, height: 625, bytes: 10656,
    sha256: 'cbfa37b1a2bff2b948228021011b453d0f780aee923fb78e50beb197ba495906',
  },
  {
    id: 'miss-ruda',
    path: 'assets/recipes/agave-companion__one-way-to-oaxaca__p257.webp',
    source: 'Agave Companion', book: '01', printedPage: 257,
    sourceImageRecipe: 'One Way to Oaxaca',
    matchBasis: 'Rocks glass, single large cube, amber body, and prominent green-herb garnish closely match Miss Ruda’s rocks, Red Ice Cube, lemon-peel, and ruda-garnish presentation.',
    evidence: 'The EPUB image on page 257 belongs to One Way to Oaxaca, not Miss Ruda. It is intentionally recorded only as the closest same-book visual representative.',
    width: 679, height: 813, bytes: 73270,
    sha256: '736ce4c078e9e59c91c703046ed24cb05c578e0703cc523adfa39a8f3b683cd3',
  },
  {
    id: 'pic-a-de-crop-punch',
    path: 'assets/recipes/death-co__billingsley-punch__p264.webp',
    source: 'Death & Co', book: '06', pdfPage: 264,
    sourceImageRecipe: 'Billingsley Punch',
    matchBasis: 'Large-format punch bowl, reddish rum-punch appearance, and multiple floating citrus wheels closely match Pic-a-de-Crop Punch’s two-person punch service and lime-wheel garnish.',
    evidence: 'Pic-a-de-Crop Punch has no dedicated photograph on its recipe page. The captioned Billingsley Punch photograph is used only as a representative.',
    width: 700, height: 759, bytes: 24200,
    sha256: '2cc9552a97c87607731db9d514b874aece25b608ddf752a4f78cee016c744077',
  },
  {
    id: 'santa-domingo',
    path: 'assets/recipes/holy-smoke__mezcal-margarita__p155.webp',
    source: "Holy Smoke! It's Mezcal!", book: 'Holy Smoke', pdfPage: 155, printedPage: 153,
    sourceImageRecipe: 'Mezcal Margarita',
    matchBasis: 'Pale mezcal-citrus profile, rocks service, sal-con-gusano/salt-style rim, and lime presentation very closely match Santa Domingo.',
    evidence: 'Santa Domingo is printed on this source page without its own dedicated photograph; the page’s named Mezcal Margarita photograph is used explicitly as a recipe-matched representative.',
    width: 383, height: 625, bytes: 10656,
    sha256: 'cbfa37b1a2bff2b948228021011b453d0f780aee923fb78e50beb197ba495906',
  },
  {
    id: 'so-danco-samba',
    path: 'assets/recipes/tropical-standard__kingston-zing__p120.webp',
    source: 'Tropical Standard', book: '03', pdfPage: 120,
    sourceImageRecipe: 'Kingston Zing',
    matchBasis: 'The source explicitly says Só Danço Samba uses the same highball method as Kingston Zing; both are pale carbonated highballs over small ice with a straw.',
    evidence: 'No dedicated Só Danço Samba photograph was verified. The exact Kingston Zing photograph is used only as a closely related same-book representative.',
    width: 700, height: 874, bytes: 62242,
    sha256: 'd06d9df7d1be98eb699f965ebf464b09b394810ade28b192a9f247938e3b9570',
  },
  {
    id: 'the-dangerous-summer',
    path: 'assets/recipes/essential-2017__blood-and-sand__p068.webp',
    source: 'Essential Cocktail Book', book: '02', pdfPage: 68,
    sourceImageRecipe: 'Blood and Sand',
    matchBasis: 'Death & Co explicitly frames The Dangerous Summer as a variation on the classic Blood and Sand; the source photograph supplies the matching deep-red up/coupe visual family.',
    evidence: 'The Dangerous Summer has no dedicated photograph in its source. This exact Blood and Sand photograph is recorded only as a recipe-matched representative.',
    width: 544, height: 822, bytes: 9002,
    sha256: '8069a1dfdebe99418c1d8fa3a0f232282c85ac8c14df0d3c791d7c062b732b89',
  },
  {
    id: 'uxmal-city',
    path: 'assets/recipes/agave-companion__spotlight-photo__p268.webp',
    source: 'Agave Companion', book: '01', printedPage: 268,
    sourceImageRecipe: 'Agave Companion bartender spotlight photo (p. 268, unlabeled in EPUB)',
    matchBasis: 'Dark blood-orange/red body, rocks service, fresh ice, and a prominent citrus wheel closely match Uxmal City’s blood-orange, chili, lime, and mezcal build.',
    evidence: 'The EPUB does not label this page-268 image as Uxmal City. It is intentionally recorded only as an unlabeled same-book visual representative.',
    width: 679, height: 731, bytes: 40556,
    sha256: 'c131a9c60018fc38069fa283bbe7cb2e8b3355755cb623e554ae0a0ad59fb770',
  },
];

for (const item of assignments) {
  const recipe = recipes.find((entry) => entry.id === item.id);
  if (!recipe) throw new Error(`Missing canonical recipe ${item.id}`);

  const absolute = path.join(root, item.path);
  if (!fs.existsSync(absolute)) throw new Error(`Missing extracted image ${item.path}`);
  const bytes = fs.readFileSync(absolute);
  const inspected = inspectWebP(bytes);
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== item.sha256 || inspected.sha256 !== item.sha256) {
    throw new Error(`SHA-256 mismatch for ${item.path}`);
  }
  if (inspected.width !== item.width || inspected.height !== item.height || bytes.length !== item.bytes) {
    throw new Error(`Image metadata mismatch for ${item.path}: ${inspected.width}x${inspected.height}, ${bytes.length} bytes`);
  }

  recipe.image = item.path;
  if (!manifest.byRecipe[item.id]) manifest.byRecipe[item.id] = { name: recipe.name, candidates: [] };
  manifest.byRecipe[item.id].name = recipe.name;
  const candidates = manifest.byRecipe[item.id].candidates || [];
  manifest.byRecipe[item.id].candidates = candidates.filter((candidate) => candidate.path !== item.path);
  manifest.byRecipe[item.id].candidates.push({
    id: item.id,
    source: item.source,
    book: item.book,
    ...(item.pdfPage ? { pdfPage: item.pdfPage } : {}),
    ...(item.printedPage ? { printedPage: item.printedPage } : {}),
    evidence: item.evidence,
    path: item.path,
    available: true,
    status: 'recipe-matched',
    sourceImageRecipe: item.sourceImageRecipe,
    matchBasis: item.matchBasis,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    sha256: item.sha256,
  });
}

manifest.generated = '2026-10-07';
fs.writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const firstAudit = auditImages({ root, checkMeta: false });
if (firstAudit.errors.length) {
  console.error(JSON.stringify(firstAudit.errors, null, 2));
  throw new Error(`Image validation failed with ${firstAudit.errors.length} error(s)`);
}

for (const field of [
  'canonicalRecipes',
  'committedImageRecipes',
  'exactBookImages',
  'exactBookImageRecipes',
  'otherVerifiedImages',
  'missingImageRecipes',
  'imageCoveragePercent',
  'staleImageReferences',
]) {
  meta[field] = firstAudit.counts[field];
}
meta.generated = '2026-10-07';
fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

const finalAudit = auditImages({ root, checkMeta: true });
if (finalAudit.errors.length) {
  console.error(JSON.stringify(finalAudit.errors, null, 2));
  throw new Error(`Final image validation failed with ${finalAudit.errors.length} error(s)`);
}

const covered = assignments.every((item) => finalAudit.recipes.find((recipe) => recipe.id === item.id)?.covered);
if (!covered) throw new Error('At least one final-ten recipe is still uncovered');

console.log(JSON.stringify({
  finalized: assignments.map((item) => item.id),
  counts: finalAudit.counts,
  warnings: finalAudit.warnings,
}, null, 2));
