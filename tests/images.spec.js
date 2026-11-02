import { test, expect } from '@playwright/test';

test('curated local backup photos decode, even when publisher sites are unavailable', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const manifest = await fetch('data/web-photos.json').then(r => r.json());
    const paths = [...new Set(Object.values(manifest.byRecipe).flatMap(r =>
      r.candidates.filter(c => c.available && c.path?.startsWith('assets/')).map(c => c.path)))];
    const failures = [];
    for (let i = 0; i < paths.length; i += 16) {
      await Promise.all(paths.slice(i, i + 16).map(async path => {
        const img = new Image();
        img.src = path;
        try { await img.decode(); }
        catch { failures.push(path); }
        if (!img.naturalWidth || !img.naturalHeight) failures.push(path);
      }));
    }
    return { count: paths.length, failures };
  });
  expect(results.count).toBeGreaterThan(30);
  expect(results.failures).toEqual([]);
});

test('publisher source image is preferred over generic images when exact URL is available', async ({ page }) => {
  await page.route('**/data/publisher-photos.json', async route => {
    await route.fulfill({ json: {
      byRecipe: { negroni: { candidates: [{
        path: 'assets/recipes/web/negroni.webp',
        sourceUrl: 'https://www.diffordsguide.com/cocktails/recipe/435/negroni',
        source: "Difford's Guide", status: 'publisher-online', available: true,
      }] } },
    } });
  });
  await page.goto('/');
  await page.locator('#searchInput').fill('Negroni');
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await expect(page.locator('.detail-copy h1')).toHaveText('Negroni');
  const image = page.locator('.detail-photo img');
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.photo-credit')).toContainText("Difford's Guide");
  await expect(page.locator('.ingredient-table')).toBeVisible();
});

test('Manhattan retains its published Simple Manhattan version independent of photography', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('Simple Manhattan');
  await page.locator('.search-item[data-recipe="manhattan"]').click();
  await expect(page.locator('.detail-copy h1')).toHaveText('Manhattan');
  const picker = page.locator("#versionSelect");
  const movieOption = picker.locator("option").filter({ hasText: "Simple Manhattan" }).first();
  await picker.selectOption(String(await movieOption.getAttribute("value")));
  await expect(picker.locator("option:checked")).toContainText("Simple Manhattan");
  await expect(page.locator('.ingredient-table')).toBeVisible();
});
