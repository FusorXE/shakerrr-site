import { test, expect } from "@playwright/test";

test("oz/ml changes ingredient table and photo callouts, reversibly", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  const first = page.locator(".ingredient-table tr").first().locator("td").last();
  await expect(first).toHaveText("1 oz");
  await page.locator("#unitBtn").click();
  await expect(page.locator("#unitBtn")).toHaveText("ml");
  await expect(first).toHaveText("29.6 ml");
  await expect(page.locator(".ingredient-overlay")).toContainText("29.6 ml");
  await page.locator("#unitBtn").click();
  await expect(first).toHaveText("1 oz");
  await expect(page.locator(".ingredient-overlay")).toContainText("1 oz");
});

test("compact source selector preserves versions and unit selection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#searchInput").fill("Capitán");
  await page.locator('.search-item[data-recipe="capitan"]').click();
  await expect(page.locator("#versionSelect")).toBeVisible();
  await expect(page.locator(".version-tabs")).toBeHidden();
  expect(await page.locator("#versionSelect option").count()).toBeGreaterThan(3);
  await page.locator("#versionSelect").selectOption({ label: "PUNCH · Bar Capitán Meléndez" });
  await expect(page.locator(".ingredient-table")).toContainText("1½ oz");
  await page.locator("#unitBtn").click();
  await expect(page.locator(".ingredient-table")).toContainText("44.4 ml");
  await page.locator("#versionSelect").selectOption({ label: "Difford’s Guide · El Capitán" });
  await expect(page.locator(".ingredient-table")).toContainText("44.4 ml");
  await expect(page.locator(".ingredient-table")).toContainText("1 dash");
  await page.locator("#unitBtn").click();
  await expect(page.locator(".ingredient-table")).toContainText("1½ oz");
});

test("unit toggle on other pages does not corrupt later recipe display", async ({ page }) => {
  await page.goto("/");
  await page.locator("#unitBtn").click();
  await expect(page.locator("#unitBtn")).toHaveText("ml");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await expect(page.locator(".ingredient-table")).toContainText("29.6 ml");
  await page.locator('[data-nav="cocktails"]').first().click();
  await page.locator("#unitBtn").click();
  await expect(page.locator("#unitBtn")).toHaveText("oz");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await expect(page.locator(".ingredient-table")).toContainText("1 oz");
});
