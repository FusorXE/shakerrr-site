import { test, expect } from '@playwright/test';

test('all committed manifest images load and decode in the browser', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const manifest = await fetch('data/image-manifest.json').then(r => r.json());
    const paths = [...new Set(Object.values(manifest.byRecipe).flatMap(r =>
      r.candidates.filter(c => c.available).map(c => c.path)))];
    const failures = [];
    for (let i = 0; i < paths.length; i += 16) {
      await Promise.all(paths.slice(i, i + 16).map(async path => {
        const image = new Image();
        image.src = path;
        try { await image.decode(); }
        catch { failures.push(path); }
        if (!image.naturalWidth || !image.naturalHeight) failures.push(path);
      }));
    }
    return { count: paths.length, failures };
  });
  expect(results.count).toBeGreaterThan(0);
  expect(results.failures).toEqual([]);
});

test('Negroni shows its integrated photograph and source credit', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('Negroni');
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await expect(page.locator('.detail-copy h1')).toHaveText('Negroni');
  const image = page.locator('.detail-photo img[data-photo-id="negroni"]');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.photo-credit')).toContainText('Essential Cocktail Book');
});

test('Simple Manhattan survives as a Manhattan version and keeps its Hollywood photograph', async ({ page }) => {
  await page.goto('/');
  await page.locator('#searchInput').fill('Simple Manhattan');
  await page.locator('.search-item[data-recipe="manhattan"]').click();
  await expect(page.locator('.detail-copy h1')).toHaveText('Manhattan');

  const tab = page.locator('.version-tab').filter({ hasText: 'Simple Manhattan' }).first();
  await expect(tab).toBeVisible();
  await tab.click();

  const image = page.locator('.detail-photo img[data-photo-id="manhattan"]');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.photo-credit')).toContainText('Hollywood Cocktails');
  await expect(image).toHaveAttribute('src', /hollywood__simple-manhattan__p163\.webp$/);
});
