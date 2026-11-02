import { test, expect } from "@playwright/test";

test("Capitan switches between publisher specs without changing the cocktail card", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Capitán");
  await page.locator('.search-item[data-recipe="capitan"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Capitán");
  const picker = page.locator("#versionSelect");
  const choices = await picker.locator("option").allTextContents();
  expect(choices.some(label => label.includes("PUNCH"))).toBe(true);
  expect(choices.some(label => label.includes("Difford"))).toBe(true);
  expect(choices.filter(label => label.includes("MJ Personal Version"))).toHaveLength(1);
  await picker.selectOption(String(choices.findIndex(label => label.includes("PUNCH"))));
  await expect(page.locator(".ingredient-table")).toContainText("Quebranta");
  await expect(page.locator(".version-pane")).toContainText("Story & history");
  await picker.selectOption(String(choices.findIndex(label => label.includes("Difford"))));
  await expect(page.locator(".ingredient-table")).toContainText("Angostura");
  await expect(page.locator(".detail-copy h1")).toHaveText("Capitán");
});

test("Blazing Saddles keeps the Death & Co book spec separate from the bartender adaptation", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Blazing Saddles");
  await page.locator('.search-item[data-recipe="blazing-saddles"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText("Blazing Saddles");
  const picker = page.locator("#versionSelect");
  await expect(picker.locator("option")).toContainText(["Death & Co", "The Jolly Bartender · adaptation", "MJ Personal Version", "+ Social recipe"]);
  await picker.selectOption({ label: "The Jolly Bartender · adaptation" });
  await expect(page.locator(".ingredient-table")).toContainText("Catoctin Creek");
  await picker.selectOption({ label: "Death & Co" });
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
