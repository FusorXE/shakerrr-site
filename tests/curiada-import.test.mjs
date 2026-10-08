import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { recipeUrl, imageUrl, extractRecipe, parseIngredient, mergeBatch, importCuriada } from '../scripts/import-curiada.mjs';

const url = 'https://curiada.com/blogs/cocktail-library/test-cocktail';
const facts = { name: 'Test Cocktail', url, image: 'https://curiada.com/cdn/shop/articles/test.jpg', published: '2026-10-01', ingredients: ['2.00 fl oz Gin', 'Top up with Club soda'], directions: ['Build over ice'] };
const { directions, ...snapshot } = facts;
const entry = { id: 'test-cocktail', expectedName: facts.name, url, sourceFingerprint: crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex'), reviewed: '2026-10-08', instructions: 'Combine over ice and stir gently.', method: 'Build', family: 'Highball', glass: 'Highball glass', garnish: '', tags: ['gin'], snapshot };
const schema = { '@type': 'Recipe', name: facts.name, url, image: [facts.image], datePublished: facts.published, recipeIngredient: facts.ingredients, recipeInstructions: facts.directions.map((text) => ({ '@type': 'HowToStep', text })) };
const html = (value) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const prepared = [{ entry, facts: snapshot, asset: 'assets/recipes/test-cocktail-curiada.webp', imageInfo: { width: 800, height: 800, bytes: 20000, sha256: 'a'.repeat(64) } }];

test('reads only the exact named recipe schema, including graph wrappers', () => {
  assert.deepEqual(extractRecipe(html({ '@graph': [{ '@type': 'WebPage' }, schema] }), entry), snapshot);
  assert.throws(() => extractRecipe(html({ ...schema, name: 'Wrong Cocktail' }), entry), /exact named/);
  assert.throws(() => extractRecipe(html([schema, schema]), entry), /exact named/);
});

test('changed quantities and preparation require a new review before import', () => {
  assert.throws(() => extractRecipe(html({ ...schema, recipeIngredient: ['10 oz Gin'] }), entry), /Source changed/);
  assert.throws(() => extractRecipe(html({ ...schema, recipeInstructions: [{ text: 'Different preparation' }] }), entry), /Source changed/);
  assert.throws(() => extractRecipe(html({ ...schema, recipeIngredient: [] }), entry), /Incomplete/);
});

test('source and image URLs are confined to named Curiada pages and its article CDN', () => {
  assert.equal(recipeUrl(url), url);
  assert.equal(imageUrl('//curiada.com/cdn/shop/articles/test.jpg', url), facts.image);
  for (const value of ['https://curiada.com/blogs/cocktail-library', url + '?page=2', 'https://example.com/blogs/cocktail-library/test-cocktail']) {
    assert.throws(() => recipeUrl(value));
  }
  assert.throws(() => imageUrl('https://example.com/photo.webp', url));
  assert.throws(() => imageUrl('data:image/png;base64,123', url));
});

test('quantities, top-up instructions and unusual ingredient lines survive parsing', () => {
  assert.deepEqual(parseIngredient('0.75 fl oz Cherry liqueur'), { amount: '0.75 fl oz', name: 'Cherry liqueur' });
  assert.deepEqual(parseIngredient('2.00 dash Orange bitters'), { amount: '2.00 dash', name: 'Orange bitters' });
  assert.deepEqual(parseIngredient('4.00 fresh Basil leaves'), { amount: '4.00 fresh', name: 'Basil leaves' });
  assert.deepEqual(parseIngredient('Top up with Ginger beer'), { amount: 'To top', name: 'Ginger beer' });
  assert.deepEqual(parseIngredient('A small pinch of salt'), { amount: '', name: 'A small pinch of salt' });
});

test('merges are idempotent and retain existing canonical specs, notes and images', () => {
  const first = mergeBatch([], { byRecipe: {} }, prepared);
  const recipe = first.recipes[0];
  recipe.note = 'Existing researched history';
  recipe.instructions = 'Existing canonical method';
  recipe.image = 'assets/recipes/existing-book.webp';
  const second = mergeBatch(first.recipes, first.manifest, prepared);
  assert.deepEqual(second.recipes, first.recipes);
  assert.deepEqual(second.manifest, first.manifest);
  assert.equal(second.report[0].action, 'unchanged');
  assert.equal(second.recipes[0].country, null);
  assert.equal(second.recipes[0].versions[0].creator, '');
});

test('id collisions and changed existing image bytes fail closed', () => {
  assert.throws(() => mergeBatch([{ id: entry.id, name: 'Different cocktail' }], { byRecipe: {} }, prepared), /collision/);
  const first = mergeBatch([], { byRecipe: {} }, prepared);
  first.manifest.byRecipe[entry.id].candidates[0].sha256 = 'b'.repeat(64);
  assert.throws(() => mergeBatch(first.recipes, first.manifest, prepared), /image changed/);
});

test('committed batch is complete, image-backed and repeatable without network', async () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../data/recipes.json', import.meta.url)));
  const report = await importCuriada({ offline: true });
  assert.equal(report.length, 8);
  assert.ok(report.every((item) => item.action === 'unchanged'));
  for (const row of report) {
    const recipe = catalog.find((item) => item.id === row.id);
    assert.ok(recipe.ingredients.length >= 3);
    assert.ok(recipe.instructions.length > 20);
    assert.equal(recipe.versions.find((version) => version.key === 'curiada').sourceUrl, row.sourceUrl);
  }
});
