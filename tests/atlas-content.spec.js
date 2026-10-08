import { test, expect } from "@playwright/test";

async function openLocal(page, area = "atlas") {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.goto(`/#${area}`);
  await expect(page.locator("main .page")).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`Atlas selection reveals usable recipes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openLocal(page);
    await page.locator('path[data-country="Brazil"]').first().click();
    await expect(page.locator("#countryDetailTitle")).toHaveText("Brazil");
    await expect(page.locator("#countryDetailTitle")).toBeInViewport();
    await expect(page.locator("#countryDetail .country-drink").first()).toBeInViewport();
    await expect(page.locator('.country-row[data-country="Brazil"]')).toHaveAttribute("aria-pressed", "true");

    await page.locator("#countrySearch").fill("Mexico");
    await page.locator('.country-row[data-country="Mexico"]').click();
    await expect(page.locator("#countryDetailTitle")).toHaveText("Mexico");
    await expect(page.locator("#countryDetailTitle")).toBeInViewport();
    const first = page.locator("#countryDetail .country-drink").first();
    await expect(first).toBeInViewport();
    const name = await first.innerText();
    await first.click();
    await expect(page.locator(".detail-copy h1")).toHaveText(name);
  });
}

test("Atlas map supports keyboard activation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLocal(page);
  const brazil = page.locator('path[data-country="Brazil"]').first();
  await brazil.focus();
  await brazil.press("Enter");
  await expect(page.locator("#countryDetailTitle")).toHaveText("Brazil");
  await expect(page.locator("#countryDetail")).toBeFocused();
});

async function searchRecipe(page, name) {
  await page.locator("#searchInput").fill(name);
  await page.locator(".search-item").filter({ hasText: name }).first().click();
}

test("known extraction apology is hidden and missing preparation is honest", async ({ page }) => {
  await openLocal(page, "cocktails");
  await searchRecipe(page, "Battle For Pueblo");
  await expect(page.locator("#versionPane")).not.toContainText(/apologies|cannot recall/i);
  await expect(page.locator(".method-box")).toContainText("Preparation details are not available in this source.");
  await searchRecipe(page, "Cilantro Bravo");
  await expect(page.locator(".method-box")).toContainText("Preparation details are not available in this source.");
});

test("published-note cleanup leaves saved personal and social notes intact", async ({ page }) => {
  const note = "Sorry, I cannot recall my exact lime amount. Try less next time.";
  await page.addInitScript((text) => {
    localStorage.setItem("shakerrr_my_battle-for-pueblo", JSON.stringify({ note: text }));
    localStorage.setItem("shakerrr_social_battle-for-pueblo", JSON.stringify([
      { platform: "Other", creator: "My friend", note: text, ingredients: [] },
    ]));
  }, note);
  await openLocal(page, "cocktails");
  await searchRecipe(page, "Battle For Pueblo");
  await page.getByRole("tab", { name: "MJ Personal Version" }).click();
  await expect(page.locator("#spec-note")).toHaveValue(note);
  await page.getByRole("tab", { name: "Other · My friend" }).click();
  await expect(page.locator("#versionPane")).toContainText(note);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("shakerrr_my_battle-for-pueblo")).note)).toBe(note);
});
