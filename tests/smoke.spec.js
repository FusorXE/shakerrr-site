import { test, expect } from "@playwright/test";

async function localOnly(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator(".brand")).toContainText("Shakerrr");
}

test("core navigation", async ({ page }) => {
  await localOnly(page);
  for (const [id, title] of [
    ["cocktails", "Cocktails"],
    ["atlas", "Shakerrr Atlas"],
    ["bar", "My Bar"],
    ["families", "Cocktail Families"],
    ["books", "Books"],
    ["movies", "Cocktails from Movies"],
    ["mezcal", "Mezcal"],
    ["amaro", "Amaro"],
    ["saved", "Saved"],
  ]) {
    await page.locator(`[data-nav="${id}"]`).first().click();
    await expect(page.locator("main")).toContainText(title);
  }
});

test("search opens a real recipe", async ({ page }) => {
  await localOnly(page);
  await page.locator("#searchInput").fill("Negroni");
  await expect(page.locator(".search-results")).toContainText("Negroni");
  await page.locator(".search-item[data-recipe]").filter({ hasText: "Negroni" }).first().click();
  await expect(page.locator(".detail-copy h1")).toContainText("Negroni");
  await expect(page.locator(".ingredient-table")).toBeVisible();
});

test("published source versions actually change content", async ({ page }) => {
  await localOnly(page);
  await page.locator("#searchInput").fill("Manhattan");
  await page.locator(".search-item[data-recipe]").filter({ hasText: "Manhattan" }).first().click();
  const tabs = page.locator(".version-tab");
  expect(await tabs.count()).toBeGreaterThan(2);
  const before = await page.locator("#versionPane").innerText();
  await tabs.nth(1).click();
  expect(await page.locator("#versionPane").innerText()).not.toBe(before);
});

test("favorite appears in Saved and persists", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="cocktails"]').first().click();
  const first = page.locator(".card").first();
  const id = await first.getAttribute("data-recipe");
  await first.locator('[data-action="fav"]').click();
  expect(await page.evaluate((recipeId) => JSON.parse(localStorage.getItem("shakerrr_favs") || "[]").includes(recipeId), id)).toBeTruthy();
  await page.locator('[data-nav="saved"]').first().click();
  await expect(page.locator(`.card[data-recipe="${id}"]`)).toBeVisible();
});

test("My Bar updates and persists", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="bar"]').first().click();
  const first = page.locator("[data-bar]").first();
  await first.click();
  await expect(page.locator(".metrics")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("shakerrr_bar"))).toBeTruthy();
  await expect(page.locator("#barResults")).toBeVisible();
});

test("Atlas region filtering exposes real countries", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="atlas"]').first().click();
  await page.locator('[data-action="region-filter"][data-region="Caribbean"]').click();
  await expect(page.locator("#countryList")).toContainText(/Barbados|Cuba|Trinidad|Bermuda/);
  await expect(page.locator("#countryDetail")).not.toBeEmpty();
});

test("Books opens a collection with recipes", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="books"]').first().click();
  const book = page.locator("[data-book]").first();
  expect(await book.count()).toBeGreaterThan(0);
  await book.click();
  await expect(page.locator(".countline")).toContainText("recipes");
  expect(await page.locator(".card[data-recipe]").count()).toBeGreaterThan(0);
});

test("Movies catalog is populated and recipe cards open", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="movies"]').first().click();
  await expect(page.locator(".countline")).toContainText("movie cocktails");
  const card = page.locator(".movie-card[data-recipe]").first();
  expect(await card.count()).toBeGreaterThan(0);
  await card.click();
  await expect(page.locator(".detail-copy h1")).toBeVisible();
});

test("Mezcal and Amaro workspaces render usable content", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="mezcal"]').first().click();
  await expect(page.locator(".countline")).toContainText("recipes");
  expect(await page.locator(".card[data-recipe]").count()).toBeGreaterThan(0);

  await page.locator('[data-nav="amaro"]').first().click();
  await expect(page.locator(".amaro-table")).toBeVisible();
  await expect(page.locator(".amaro-table")).toContainText("Campari");
  await page.locator('[data-action="amaro-recipes"]').first().click();
  await expect(page.locator("#modal")).toHaveClass(/show/);
});

test("Cocktail Families preset updates graph and result", async ({ page }) => {
  await localOnly(page);
  await page.locator('[data-nav="families"]').first().click();
  await page.locator('[data-action="family-preset"][data-family-name="Negroni"]').click();
  await expect(page.locator("#familySvg")).toContainText("Negroni");
  await expect(page.locator("#familyResult")).toContainText("Closest structure");
});

test("unit toggle changes and persists", async ({ page }) => {
  await localOnly(page);
  const button = page.locator("#unitBtn");
  const before = await button.innerText();
  await button.click();
  const after = await button.innerText();
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => localStorage.getItem("shakerrr_unit"))).toBe(after);
});

test("Tools exposes Swap Lab, Ingredients and backup actions", async ({ page }) => {
  await localOnly(page);
  await page.locator("#toolsBtn").click();
  await expect(page.locator("#drawer")).toHaveClass(/open/);
  await expect(page.locator('#drawer [data-action="swap"]')).toBeVisible();
  await expect(page.locator('[data-action="ingredients"]')).toBeVisible();
  await expect(page.locator('[data-action="export-data"]')).toBeVisible();
  await expect(page.locator('[data-action="import-data"]')).toBeVisible();

  await page.locator('#drawer [data-action="swap"]').click();
  await expect(page.locator("#modal")).toHaveClass(/show/);
  await expect(page.locator("#swapFrom")).toBeVisible();
});

test("mobile navigation exposes primary areas and tools", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await localOnly(page);
  await expect(page.locator("#mobileNav")).toBeVisible();
  await page.locator('#mobileNav [data-nav="cocktails"]').click();
  await expect(page.locator("main")).toContainText("Cocktails");
  await page.locator('#mobileNav [data-action="open-drawer"]').click();
  await expect(page.locator("#drawer")).toHaveClass(/open/);
  await expect(page.locator('[data-nav="movies"]').last()).toBeVisible();
  await expect(page.locator('[data-action="export-data"]')).toBeVisible();
});
