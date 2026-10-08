import { test, expect } from "@playwright/test";

async function visiblePhoto(image) {
  await image.locator("..").scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(image).toBeVisible();
  const host = image.locator("..");
  await expect(host.locator(".photo-status")).toBeHidden();
  await expect(host).toHaveClass(/photo-loaded/);
}

for (const width of [1440, 390]) {
  test(`book photographs and full text are visible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#books");
    await page.locator('[data-book="Death%20%26%20Co"]').click();
    const card = page.locator('.card[data-recipe="angies-secret"]');
    await visiblePhoto(card.locator("img"));
    const text = card.locator(".ingredient-line");
    expect(
      await text.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    await card.click();
    await visiblePhoto(page.locator(".detail-photo img"));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/book-detail-${width}.png`,
      fullPage: true,
    });
  });
  test(`Movies use exact book photos and open the matching version at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#movies");
    const card = page.locator('.movie-card[data-recipe="cosmopolitan"]');
    await visiblePhoto(card.locator("img"));
    await expect(card.locator("img")).toHaveAttribute(
      "src",
      /hollywood__classic-cosmopolitan/,
    );
    await card.click();
    await visiblePhoto(page.locator(".detail-photo img"));
    await expect(page.locator(".detail-photo img")).toHaveAttribute(
      "src",
      /hollywood__classic-cosmopolitan/,
    );
    await expect(page.locator(".photo-credit")).toContainText(
      "scene image unavailable",
    );
    await page.screenshot({
      animations: "disabled",
      path: `test-results/movie-detail-${width}.png`,
      fullPage: true,
    });
  });
}

test("Movies without an exact movie-book image show an honest missing state", async ({
  page,
}) => {
  await page.goto("/#movies");
  const card = page.locator('.movie-card[data-recipe="bloody-mary"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".photo-status")).toHaveText(
    "No verified movie-book photograph",
  );
  await expect(card.locator("img")).toBeHidden();
});

test("refresh system photo fetches a fresh manifest and restores the visible image", async ({
  page,
}) => {
  let manifests = 0;
  page.on("request", (r) => {
    if (r.url().includes("image-manifest.json")) manifests++;
  });
  await page.goto("/");
  await page.locator("#searchInput").fill("Negroni");
  await page.locator('.search-item[data-recipe="negroni"]').click();
  await visiblePhoto(page.locator(".detail-photo img"));
  const before = manifests;
  await page.locator('[data-action="refresh-photo"]').click();
  await expect.poll(() => manifests).toBeGreaterThan(before);
  await expect(page.locator('[data-action="refresh-photo"]')).toBeEnabled();
  await expect(page.locator(".detail-photo")).toHaveClass(/photo-loaded/);
  await visiblePhoto(page.locator(".detail-photo img"));
});

test("movie source version keeps its photo while other source tabs can change it", async ({
  page,
}) => {
  await page.goto("/#movies");
  await page.locator('.movie-card[data-recipe="manhattan"]').click();
  await expect(
    page.locator('.version-tab[aria-selected="true"]'),
  ).toContainText("Simple Manhattan");
  await visiblePhoto(page.locator(".detail-photo img"));
  await expect(page.locator(".detail-photo img")).toHaveAttribute(
    "src",
    /hollywood__simple-manhattan/,
  );
  await page
    .locator(".version-tab")
    .filter({ hasText: "Essential Cocktail Book" })
    .click();
  await visiblePhoto(page.locator(".detail-photo img"));
  await expect(page.locator(".detail-photo img")).toHaveAttribute(
    "src",
    /essential-2017__manhattan/,
  );
});
