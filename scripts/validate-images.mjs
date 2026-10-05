import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const positiveInteger = (value) => (typeof value === 'number' || typeof value === 'string') && Number.isInteger(Number(value)) && Number(value) > 0;
const compareId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Parse the RIFF container and static WebP frame headers without external tools.
// This checks structure and dimensions, not a full entropy decode of the pixels.
export function inspectWebP(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('File is not a WebP RIFF container');
  }
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) {
    throw new Error('WebP RIFF size does not match the file length');
  }
  let frame;
  let canvas;
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated WebP chunk header');
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    const paddedEnd = end + (size & 1);
    if (paddedEnd > bytes.length) throw new Error(`Truncated WebP ${type} chunk`);
    if (type === 'VP8X') {
      if (canvas || frame || size !== 10) throw new Error('Invalid WebP extended header');
      if (bytes[start] & 0x02) throw new Error('Animated WebP is not a static recipe asset');
      canvas = {
        width: bytes.readUIntLE(start + 4, 3) + 1,
        height: bytes.readUIntLE(start + 7, 3) + 1,
      };
    } else if (type === 'VP8 ') {
      if (frame || size < 11 || (bytes[start] & 1) !== 0 ||
          bytes.toString('hex', start + 3, start + 6) !== '9d012a') {
        throw new Error('Invalid or duplicate WebP VP8 key frame');
      }
      const firstPartitionSize = bytes.readUIntLE(start, 3) >>> 5;
      if (firstPartitionSize === 0 || firstPartitionSize + 10 > size) {
        throw new Error('Truncated WebP VP8 first partition');
      }
      frame = {
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    } else if (type === 'VP8L') {
      if (frame || size < 6 || bytes[start] !== 0x2f) {
        throw new Error('Invalid or duplicate WebP lossless frame');
      }
      const bits = bytes.readUInt32LE(start + 1);
      if ((bits >>> 29) !== 0) throw new Error('Unsupported WebP lossless version');
      frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (type === 'ANIM' || type === 'ANMF') {
      throw new Error('Animated WebP is not a static recipe asset');
    }
    offset = paddedEnd;
  }
  if (!frame || frame.width < 1 || frame.height < 1) throw new Error('WebP has no valid image frame');
  if (canvas && (canvas.width !== frame.width || canvas.height !== frame.height)) {
    throw new Error('WebP canvas and frame dimensions disagree');
  }
  return { ...frame, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function inspectLocalAsset(root, assetPath) {
  if (!nonempty(assetPath) || path.isAbsolute(assetPath) || assetPath.includes('\\') ||
      /[?#]/.test(assetPath) || !assetPath.startsWith('assets/recipes/') ||
      path.posix.normalize(assetPath) !== assetPath || !assetPath.endsWith('.webp')) {
    throw new Error('Expected a normalized local assets/recipes/*.webp path');
  }
  const file = path.resolve(root, assetPath);
  const real = fs.realpathSync(file);
  const relative = path.relative(fs.realpathSync(root), real);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Image file resolves outside the repository');
  }
  if (!fs.statSync(file).isFile()) throw new Error('Image path is not a regular file');
  return inspectWebP(fs.readFileSync(file));
}

export function auditImages({ root = process.cwd(), checkMeta = false } = {}) {
  root = path.resolve(root);
  const catalog = readJson(path.join(root, 'data/recipes.json'));
  const manifest = readJson(path.join(root, 'data/image-manifest.json'));
  if (!Array.isArray(catalog)) throw new Error('Canonical recipes must be an array');
  if (!manifest.byRecipe || typeof manifest.byRecipe !== 'object' || Array.isArray(manifest.byRecipe)) {
    throw new Error('Image manifest must contain a byRecipe object');
  }
  const errors = [];
  const warnings = [];
  const candidates = [];
  const catalogIds = new Set(catalog.map((recipe) => recipe.id));
  const byRecipe = new Map();
  const inspected = new Map();
  const addError = (code, recipeId, message, assetPath) => {
    const issue = { code, recipeId, ...(assetPath ? { path: assetPath } : {}), message };
    errors.push(issue);
    return issue;
  };
  for (const [recipeId, entry] of Object.entries(manifest.byRecipe)) {
    if (!entry || !Array.isArray(entry.candidates)) {
      addError('invalid-candidates', recipeId, 'Manifest entry must contain a candidates array');
      continue;
    }
    if (!catalogIds.has(recipeId)) {
      if (entry.candidates.length) addError('unknown-canonical-id', recipeId, 'Manifest candidates have no canonical recipe');
      else warnings.push({ code: 'historical-empty-manifest-entry', recipeId, message: 'Empty historical manifest entry has no current canonical recipe' });
    }
    const seenPaths = new Set();
    for (const candidate of entry.candidates) {
      const issues = [];
      const fail = (code, message) => issues.push(addError(code, recipeId, message, candidate?.path));
      const result = { recipeId, candidate, valid: false, issues };
      candidates.push(result);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        fail('invalid-candidate', 'Candidate must be an object');
        continue;
      }
      if (typeof candidate.available !== 'boolean') fail('invalid-availability', 'Candidate available must be a boolean');
      if (!candidate.available) continue;
      if (!catalogIds.has(recipeId)) fail('unknown-canonical-target', 'Available image has no canonical target');
      if (candidate.id !== recipeId) fail('candidate-target-mismatch', `Candidate id ${JSON.stringify(candidate.id)} does not match its canonical recipe`);
      if (!nonempty(candidate.source)) fail('missing-source', 'Available image must preserve its source');
      if (!nonempty(candidate.evidence)) fail('missing-evidence', 'Available image must preserve its verification evidence');
      if (!nonempty(candidate.status)) fail('missing-status', 'Available image must have a verification status');
      if (candidate.status === 'exact-book') {
        if (!nonempty(candidate.book)) fail('missing-book', 'Exact book image must preserve its book identifier');
        if (![candidate.page, candidate.pdfPage, candidate.printedPage].some(positiveInteger)) {
          fail('missing-page', 'Exact book image must preserve a positive page, pdfPage, or printedPage');
        }
      } else {
        fail('unsupported-verification-status', `Unsupported image verification status ${JSON.stringify(candidate.status)}; explicitly define its evidence requirements before counting it`);
      }
      for (const field of ['page', 'pdfPage', 'printedPage', 'recipePdfPage']) {
        if (candidate[field] != null && !positiveInteger(candidate[field])) {
          fail('invalid-page', `${field} must be a positive integer when present`);
        }
      }
      if (!/^[a-f0-9]{64}$/i.test(candidate.sha256 || '')) fail('missing-sha256', 'Available image must have a SHA-256 digest');
      if (!positiveInteger(candidate.width) || !positiveInteger(candidate.height)) {
        fail('missing-dimensions', 'Available image must preserve positive width and height');
      }
      if (seenPaths.has(candidate.path)) fail('duplicate-path', 'Duplicate available candidate path for the same recipe');
      seenPaths.add(candidate.path);
      try {
        if (!inspected.has(candidate.path)) inspected.set(candidate.path, inspectLocalAsset(root, candidate.path));
        result.asset = inspected.get(candidate.path);
        if (result.asset.sha256 !== candidate.sha256?.toLowerCase()) fail('sha256-mismatch', 'Image SHA-256 does not match the manifest');
        if (result.asset.width !== Number(candidate.width) || result.asset.height !== Number(candidate.height)) {
          fail('dimension-mismatch', `Image is ${result.asset.width} × ${result.asset.height}, manifest says ${candidate.width} × ${candidate.height}`);
        }
        for (const field of ['bytes', 'sizeBytes']) {
          if (candidate[field] != null && Number(candidate[field]) !== result.asset.bytes) {
            fail('byte-size-mismatch', `Image has ${result.asset.bytes} bytes; ${field} says ${candidate[field]}`);
          }
        }
      } catch (error) {
        fail('invalid-image-file', error.message);
      }
      result.valid = issues.length === 0;
    }
    byRecipe.set(recipeId, candidates.filter((result) => result.recipeId === recipeId));
  }
  const recipes = catalog.map((recipe) => {
    const records = byRecipe.get(recipe.id) || [];
    const valid = records.filter((result) => result.valid);
    const selected = valid.find((result) => result.candidate.path === recipe.image);
    if (recipe.image != null && !selected) {
      addError('invalid-recipe-image', recipe.id, 'Canonical image must point to an available, verified manifest candidate with a valid local file', recipe.image);
    } else if (valid.length > 0 && recipe.image == null) {
      addError('missing-recipe-image', recipe.id, 'Verified candidates exist but the canonical recipe image path is unset');
    }
    for (const version of recipe.versions || []) {
      if (version.image != null && !valid.some((result) => result.candidate.path === version.image)) {
        addError('invalid-version-image', recipe.id, `Recipe version ${version.key || version.label || '(unnamed)'} image does not resolve to an available verified candidate`, version.image);
      }
    }
    const reason = selected ? null : valid.length ? 'canonical-image-unset-or-invalid' :
      records.some((result) => result.candidate?.available) ? 'available-candidates-failed-validation' :
      records.length ? 'no-available-candidate' : 'no-image-candidate';
    return {
      id: recipe.id, name: recipe.name, category: recipe.category || '',
      collections: recipe.collections || [], image: recipe.image ?? null,
      verifiedCandidates: valid.length, covered: Boolean(selected), reason,
    };
  }).sort(compareId);
  const validCandidates = candidates.filter((candidate) => candidate.valid);
  const covered = recipes.filter((recipe) => recipe.covered);
  const unresolved = recipes.filter((recipe) => !recipe.covered);
  const hashes = new Map();
  for (const result of validCandidates) {
    const paths = hashes.get(result.asset.sha256) || new Set();
    paths.add(result.candidate.path);
    hashes.set(result.asset.sha256, paths);
  }
  for (const [sha256, paths] of hashes) {
    if (paths.size > 1) warnings.push({ code: 'duplicate-file-bytes', sha256, paths: [...paths].sort(), message: 'Identical WebP bytes are stored at multiple paths' });
  }
  const counts = {
    canonicalRecipes: catalog.length,
    manifestCandidates: candidates.length,
    availableCandidates: candidates.filter((result) => result.candidate?.available === true).length,
    verifiedImageCandidates: validCandidates.length,
    uniqueVerifiedImageFiles: new Set(validCandidates.map((result) => result.candidate.path)).size,
    uniqueVerifiedImageHashes: hashes.size,
    recipesWithVerifiedCandidates: recipes.filter((recipe) => recipe.verifiedCandidates > 0).length,
    committedImageRecipes: covered.length,
    exactBookImages: validCandidates.filter((result) => result.candidate.status === 'exact-book').length,
    exactBookImageRecipes: covered.filter((recipe) => byRecipe.get(recipe.id)?.some((result) => result.valid && result.candidate.status === 'exact-book')).length,
    otherVerifiedImages: validCandidates.filter((result) => result.candidate.status !== 'exact-book').length,
    missingImageRecipes: unresolved.length,
    imageCoveragePercent: catalog.length ? +(100 * covered.length / catalog.length).toFixed(1) : 0,
    staleImageReferences: candidates.filter((result) => !result.valid).length,
  };
  if (checkMeta) {
    const meta = readJson(path.join(root, 'data/catalog-meta.json'));
    for (const field of ['canonicalRecipes', 'committedImageRecipes', 'exactBookImages', 'exactBookImageRecipes', 'otherVerifiedImages', 'missingImageRecipes', 'imageCoveragePercent', 'staleImageReferences']) {
      if (meta[field] !== counts[field]) addError('catalog-meta-mismatch', null, `${field}: catalog-meta has ${JSON.stringify(meta[field])}, validated catalog has ${counts[field]}`);
    }
  }
  return { counts, candidates, recipes, unresolved, errors, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const audit = auditImages({ checkMeta: true });
    console.log(JSON.stringify({ counts: audit.counts, errors: audit.errors, warnings: audit.warnings }, null, 2));
    if (audit.errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(`Image validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
