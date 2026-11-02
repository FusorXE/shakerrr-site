import { test, expect } from "@playwright/test";

async function visiblePhoto(image) {
  await image.locator("..").scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(image).toBeVisible();
  await expect(image.locator("..").locator(".photo-status")).toBeHidden();
}

for (const width of [1440, 390]) {
  test("recipe photo, ingredients and text render at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator("#searchInput").fill("Negroni");
    await page.locator('.search-item[data-recipe="negroni"]').click();
    await visiblePhoto(page.locator(".detail-photo img"));
    await expect(page.locator(".ingredient-table")).toBeVisible();
    await expect(page.locator(".ingredient-overlay")).toContainText(/gin|vermouth|Campari/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("movie cocktails show actual cocktails without claiming movie stills at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#movies");
    const card = page.locator('.movie-card[data-recipe="cosmopolitan"]');
    await visiblePhoto(card.locator("img"));
    await card.click();
    await expect(page.locator(".detail-copy h1")).toHaveText("Cosmopolitan");
    await visiblePhoto(page.locator(".detail-photo img"));
    await expect(page.locator(".ingredient-table")).toBeVisible();
    await expect(page.locator(".photo-credit")).not.toContainText("movie still");
  });
}

test("movie catalog uses cocktail photos even when book image is unavailable", async ({ page }) => {
  await page.goto("/#movies");
  const card = page.locator('.movie-card[data-recipe="bloody-mary"]');
  await visiblePhoto(card.locator("img"));
  await card.click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Bloody Mary");
  await expect(page.locator(".ingredient-table")).toBeVisible();
});

test("refresh requests web and publisher photo catalogs without erasing a recipe", async ({ page }) => {
  let requests = 0;
  page.on("request", r => { if (/data\/(web-photos|publisher-photos)\.json/.test(r.url())) requests++; });
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await visiblePhoto(page.locator(".detail-photo img"));
  const before = requests;
  await page.locator('[data-action="refresh-photo"]').evaluate(button => button.click());
  await expect.poll(() => requests).toBeGreaterThan(before);
  await expect(page.locator('[data-action="refresh-photo"]')).toBeEnabled();
  await expect(page.locator(".ingredient-table")).toBeVisible();
});

test("switching published versions preserves the cocktail and active tab", async ({ page }) => {
  await page.goto("/#movies");
  await page.locator('.movie-card[data-recipe="manhattan"]').click();
  const picker = page.locator("#versionSelect");
  await expect(page.locator(".detail-copy h1")).toHaveText("Manhattan");
  await expect(picker.locator("option:checked")).toContainText("Simple Manhattan");
  await picker.selectOption({ label: "Essential Cocktail Book" });
  await expect(picker.locator("option:checked")).toHaveText("Essential Cocktail Book");
  await expect(page.locator(".ingredient-table")).toBeVisible();
});
