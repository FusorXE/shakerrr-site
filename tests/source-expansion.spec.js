import { test, expect } from "@playwright/test";

test("Capitan switches between publisher specs without changing the cocktail card", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Capitán");
  await page.locator('.search-item[data-recipe="capitan"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Capitán");
  const tabs = page.locator(".version-tab");
  await expect(tabs.filter({ hasText: "PUNCH" })).toBeVisible();
  await expect(tabs.filter({ hasText: "Difford" })).toBeVisible();
  await expect(tabs.filter({ hasText: "MJ Personal Version" })).toHaveCount(1);
  await tabs.filter({ hasText: "PUNCH" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Quebranta");
  await expect(page.locator(".version-pane")).toContainText("Story & history");
  await tabs.filter({ hasText: "Difford" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Angostura");
  await expect(page.locator(".detail-copy h1")).toHaveText("Capitán");
});

test("Blazing Saddles keeps the Death & Co book spec separate from the bartender adaptation", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Blazing Saddles");
  await page.locator('.search-item[data-recipe="blazing-saddles"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Blazing Saddles");
  const tabs = page.locator(".version-tab");
  await expect(tabs.filter({ hasText: "Death & Co" })).toBeVisible();
  await tabs.filter({ hasText: "The Jolly Bartender" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Catoctin Creek");
  await tabs.filter({ hasText: "Death & Co" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("High West");
});

test("new Atlas countries open real, sourced recipe detail pages", async ({ page }) => {
  await page.goto("/#atlas");
  for (const country of ["Finland", "Russia", "Turkey", "Greece", "China"]) {
    await expect(page.locator('.country-row[data-country="' + country + '"]')).toBeVisible();
  }
  await page.locator('.country-row[data-country="Turkey"]').click();
  await page.locator('#countryDetail [data-recipe="atlas-spicy-pomegranate-istanbul"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Spicy Pomegranate (Istanbul)");
  await expect(page.locator(".ingredient-table")).toContainText("Pomegranate juice");
  await expect(page.locator(".version-pane")).toContainText("Story & history");
});
