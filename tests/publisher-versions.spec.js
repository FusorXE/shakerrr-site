import { test, expect } from "@playwright/test";

async function open(page, id, name) {
  await page.route("**/*", route => { const host = new URL(route.request().url()).hostname; return ["localhost", "127.0.0.1"].includes(host) ? route.continue() : route.abort(); });
  await page.goto("/");
  await page.locator("#searchInput").fill(name);
  await page.locator('.search-item[data-recipe="' + id + '"]').click();
  await expect(page.locator(".detail-copy h1")).toHaveText(name);
}

test("Bicicletta retains its original recipe, adds two sourced variants and keeps MJ editable", async ({ page }) => {
  await open(page, "bicicletta", "Bicicletta");
  const tabs = page.locator(".version-tab");
  await expect(tabs).toContainText(["Essential Cocktail Book", "Liquor.com", "Difford’s Guide · Bicicletta Spritz", "MJ Personal Version", "+ Social recipe"]);
  await page.getByRole("tab", { name: "Liquor.com" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("3 oz");
  await expect(page.locator("#versionPane a")).toHaveAttribute("href", "https://www.liquor.com/recipes/bicicletta/");
  await page.getByRole("tab", { name: "Difford’s Guide · Bicicletta Spritz" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("1⅓ oz");
  await page.getByRole("tab", { name: "MJ Personal Version" }).click();
  await expect(page.locator("#specIngredients")).toBeVisible();
});

test("American Trilogy presents Difford's and PUNCH separately without replacing book spec", async ({ page }) => {
  await open(page, "american-trilogy", "American Trilogy");
  await page.getByRole("tab", { name: "Difford’s Guide" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Rich brown sugar syrup");
  await page.getByRole("tab", { name: "PUNCH" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Brown sugar");
  await page.getByRole("tab", { name: "Essential Cocktail Book" }).click();
  await expect(page.locator(".ingredient-table")).toContainText("Brown Sugar Cube");
});

test("Padang Swizzle links to its exact PUNCH source while keeping its original source tab", async ({ page }) => {
  await open(page, "padang-swizzle", "Padang Swizzle");
  await expect(page.locator(".version-tab")).toContainText(["Cocktail Virgin / Punch", "PUNCH", "MJ Personal Version", "+ Social recipe"]);
  await page.getByRole("tab", { name: "PUNCH", exact: true }).click();
  await expect(page.locator("#versionPane a")).toHaveAttribute("href", "https://punchdrink.com/recipes/padang-swizzle/");
});
