import { test, expect } from "@playwright/test";

test("many recipe sources scroll horizontally as readable chips instead of vertical text", async ({ page }) => {
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  const tabs = page.locator(".version-tab");
  expect(await tabs.count()).toBeGreaterThan(7);
  const widths = await tabs.first().evaluate(button => {
    const style = getComputedStyle(button);
    return { shrink: style.flexShrink, whitespace: style.whiteSpace, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height };
  });
  expect(widths.shrink).toBe("0");
  expect(widths.whitespace).toBe("nowrap");
  expect(widths.width).toBeGreaterThan(80);
  expect(widths.height).toBeLessThan(65);
});

test("small-screen recipe versions use a working native dropdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await expect(page.locator("#versionSelect")).toBeVisible();
  await expect(page.locator(".version-tabs")).toBeHidden();
  const values = await page.locator("#versionSelect option").allTextContents();
  expect(values.some(label => /Tropical Standard/i.test(label))).toBe(true);
  const index = values.findIndex(label => /Tropical Standard/i.test(label));
  await page.locator("#versionSelect").selectOption(String(index));
  await expect(page.locator("#versionSelect")).toHaveValue(String(index));
  await expect(page.locator(".source-head")).toContainText("Tropical Standard");
});
