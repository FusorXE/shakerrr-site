import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { auditImages, inspectWebP } from '../scripts/validate-images.mjs';

// Real 2 × 3 WebP images, independently encoded by Pillow/libwebp.
const lossy = Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACwAQCdASoCAAMAAUAmJZgCdLoABDAAAP72lZf+Ic6HOhzMZ9tmD6C0AAA=', 'base64');
const lossless = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAYAAAAdQlGoVr/+BiOh/AAA=', 'base64');

function fixture(t, mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shakerrr-image-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'assets/recipes'), { recursive: true });
  const candidate = {
    id: 'alpha', source: 'A Cocktail Book', book: '01', printedPage: 12,
    evidence: 'Named caption on page 12', status: 'exact-book', available: true,
    path: 'assets/recipes/alpha.webp', width: 2, height: 3,
    sha256: crypto.createHash('sha256').update(lossy).digest('hex'),
  };
  const data = {
    root, candidate,
    recipes: [
      { id: 'zulu', name: 'Zulu', image: null, versions: [] },
      { id: 'alpha', name: 'Alpha', image: candidate.path, versions: [] },
      { id: 'bravo', name: 'Bravo', image: null, versions: [] },
    ],
    manifest: { byRecipe: { alpha: { candidates: [candidate] }, old: { candidates: [] } } },
  };
  fs.writeFileSync(path.join(root, candidate.path), lossy);
  mutate(data);
  fs.writeFileSync(path.join(root, 'data/recipes.json'), JSON.stringify(data.recipes));
  fs.writeFileSync(path.join(root, 'data/image-manifest.json'), JSON.stringify(data.manifest));
  return { ...data, audit: auditImages({ root }) };
}

test('reads dimensions and digest from real lossy and lossless WebPs', () => {
  for (const bytes of [lossy, lossless]) {
    const inspected = inspectWebP(bytes);
    assert.equal(inspected.width, 2);
    assert.equal(inspected.height, 3);
    assert.equal(inspected.bytes, bytes.length);
    assert.equal(inspected.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  }
});

test('rejects disguised files, truncation, false chunk lengths, and invalid frame signatures', () => {
  assert.throws(() => inspectWebP(Buffer.from('a nonempty file named image.webp')), /not a WebP/);
  assert.throws(() => inspectWebP(lossy.subarray(0, lossy.length - 2)), /file length/);
  const oversizedChunk = Buffer.from(lossy);
  oversizedChunk.writeUInt32LE(lossy.length, 16);
  assert.throws(() => inspectWebP(oversizedChunk), /Truncated WebP/);
  const invalidFrame = Buffer.from(lossy);
  invalidFrame[23] = 0;
  assert.throws(() => inspectWebP(invalidFrame), /key frame/);
});

test('counts only covered canonical recipes and sorts the exact unresolved list', (t) => {
  const { audit } = fixture(t);
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.counts.canonicalRecipes, 3);
  assert.equal(audit.counts.committedImageRecipes, 1);
  assert.equal(audit.counts.missingImageRecipes, 2);
  assert.deepEqual(audit.unresolved.map((recipe) => recipe.id), ['bravo', 'zulu']);
  assert.equal(audit.warnings[0].code, 'historical-empty-manifest-entry');
});

test('rejects hash, size, dimension, and evidence mismatches from coverage', (t) => {
  const { audit } = fixture(t, ({ candidate }) => {
    candidate.sha256 = '0'.repeat(64);
    candidate.width = 99;
    candidate.sizeBytes = 1;
    delete candidate.evidence;
  });
  const codes = new Set(audit.errors.map((issue) => issue.code));
  for (const code of ['sha256-mismatch', 'dimension-mismatch', 'byte-size-mismatch', 'missing-evidence', 'invalid-recipe-image']) {
    assert.ok(codes.has(code), code);
  }
  assert.equal(audit.counts.committedImageRecipes, 0);
  assert.equal(audit.counts.verifiedImageCandidates, 0);
});

test('rejects assets assigned to an unknown or mismatched canonical target', (t) => {
  const { audit } = fixture(t, ({ candidate, manifest }) => {
    candidate.id = 'bravo';
    manifest.byRecipe.orphan = { candidates: [{ ...candidate, id: 'orphan' }] };
  });
  const codes = new Set(audit.errors.map((issue) => issue.code));
  assert.ok(codes.has('candidate-target-mismatch'));
  assert.ok(codes.has('unknown-canonical-id'));
  assert.ok(codes.has('unknown-canonical-target'));
  assert.equal(audit.counts.verifiedImageCandidates, 0);
});

test('rejects missing selections and invalid recipe version image paths', (t) => {
  const { audit } = fixture(t, ({ recipes }) => {
    recipes[1].image = null;
    recipes[1].versions = [{ key: 'book', image: 'assets/recipes/not-in-manifest.webp' }];
  });
  assert.equal(audit.counts.recipesWithVerifiedCandidates, 1);
  assert.equal(audit.counts.committedImageRecipes, 0);
  assert.ok(audit.errors.some((issue) => issue.code === 'missing-recipe-image'));
  assert.ok(audit.errors.some((issue) => issue.code === 'invalid-version-image'));
});

test('does not count unavailable candidates or inspect their missing files', (t) => {
  const { audit } = fixture(t, ({ candidate, recipes, root }) => {
    candidate.available = false;
    recipes[1].image = null;
    fs.unlinkSync(path.join(root, candidate.path));
  });
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.counts.availableCandidates, 0);
  assert.equal(audit.counts.staleImageReferences, 1);
  assert.equal(audit.unresolved[0].reason, 'no-available-candidate');
});

test('rejects traversal paths and symlinks that escape the catalog root', (t) => {
  const traversal = fixture(t, ({ candidate }) => { candidate.path = 'assets/recipes/../../../image.webp'; });
  assert.ok(traversal.audit.errors.some((issue) => issue.code === 'invalid-image-file'));
  const symlink = fixture(t, ({ root, candidate }) => {
    const outside = path.join(os.tmpdir(), `shakerrr-outside-${crypto.randomUUID()}.webp`);
    fs.writeFileSync(outside, lossy);
    t.after(() => fs.rmSync(outside, { force: true }));
    fs.unlinkSync(path.join(root, candidate.path));
    fs.symlinkSync(outside, path.join(root, candidate.path));
  });
  assert.ok(symlink.audit.errors.some((issue) => issue.message === 'Image file resolves outside the repository'));
});

test('detects stale image counts in catalog-meta', (t) => {
  const { root, audit } = fixture(t);
  fs.writeFileSync(path.join(root, 'data/catalog-meta.json'), JSON.stringify({ ...audit.counts, committedImageRecipes: 2 }));
  const checked = auditImages({ root, checkMeta: true });
  assert.equal(checked.errors.length, 1);
  assert.equal(checked.errors[0].code, 'catalog-meta-mismatch');
  assert.match(checked.errors[0].message, /committedImageRecipes/);
});
