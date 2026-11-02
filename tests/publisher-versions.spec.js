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
  const picker = page.locator("#versionSelect");
  await expect(picker.locator("option")).toContainText(["Essential Cocktail Book", "Liquor.com", "Difford’s Guide · Bicicletta Spritz", "MJ Personal Version", "+ Social recipe"]);
  await picker.selectOption({ label: "Liquor.com" });
  await expect(page.locator(".ingredient-table")).toContainText("3 oz");
  await expect(page.locator("#versionPane a")).toHaveAttribute("href", "https://www.liquor.com/recipes/bicicletta/");
  await picker.selectOption({ label: "Difford’s Guide · Bicicletta Spritz" });
  await expect(page.locator(".ingredient-table")).toContainText("1⅓ oz");
  await picker.selectOption({ label: "MJ Personal Version" });
  await expect(page.locator("#specIngredients")).toBeVisible();
});

test("American Trilogy presents Difford's and PUNCH separately without replacing book spec", async ({ page }) => {
  await open(page, "american-trilogy", "American Trilogy");
  await page.locator("#versionSelect").selectOption({ label: "Difford’s Guide" });
  await expect(page.locator(".ingredient-table")).toContainText("Rich brown sugar syrup");
  await page.locator("#versionSelect").selectOption({ label: "PUNCH" });
  await expect(page.locator(".ingredient-table")).toContainText("Brown sugar");
  await page.locator("#versionSelect").selectOption({ label: "Essential Cocktail Book" });
  await expect(page.locator(".ingredient-table")).toContainText("Brown Sugar Cube");
});

test("Padang Swizzle links to its exact PUNCH source while keeping its original source tab", async ({ page }) => {
  await open(page, "padang-swizzle", "Padang Swizzle");
  await expect(page.locator("#versionSelect option")).toContainText(["Cocktail Virgin / Punch", "PUNCH", "MJ Personal Version", "+ Social recipe"]);
  await page.locator("#versionSelect").selectOption({ label: "PUNCH" });
  await expect(page.locator("#versionPane a")).toHaveAttribute("href", "https://punchdrink.com/recipes/padang-swizzle/");
});
