test("desktop source versions use a compact dropdown instead of an oversized lineup", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  const picker = page.locator("#versionSelect");
  await expect(picker).toBeVisible();
  await expect(page.locator(".version-tabs")).toBeHidden();
  expect(await picker.locator("option").count()).toBeGreaterThan(7);
  const dimensions = await picker.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
  expect(dimensions.width).toBeLessThan(470);
  expect(dimensions.height).toBeLessThan(70);
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
