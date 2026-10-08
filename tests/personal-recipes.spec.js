import { test, expect } from "@playwright/test";

async function openPersonal(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".card").first()).toBeVisible();
  await page.locator("#searchInput").fill("Negroni");
  const result = page.locator(".search-item[data-recipe]").filter({ hasText: "Negroni" }).first();
  const id = await result.getAttribute("data-recipe");
  await result.click();
  await page.getByRole("tab", { name: "MJ Personal Version" }).click();
  return "shakerrr_my_" + id;
}

async function savedSpec(page, key) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
}

for (const width of [1280, 390]) {
  test(`personal recipes accept ordinary ingredient lines and optional fields at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const key = await openPersonal(page);
    const dialogs = [];
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    const lines = "1 oz Gin\n0.75 oz Sweet Vermouth\n3 dashes of cardamom bitters\nA little soda, to taste\n½ oz lime juice\n1/2 oz | lemon juice";
    await page.locator("#specIngredients").fill(lines);
    await page.locator('[data-action="save-my-recipe"]').click();
    await expect(page.locator('[data-action="save-my-recipe"]')).toHaveText("Saved");
    expect(await savedSpec(page, key)).toMatchObject({
      ingredientText: lines,
      instructions: "",
      ingredients: [
        { amount: "1 oz", name: "Gin" },
        { amount: "0.75 oz", name: "Sweet Vermouth" },
        { amount: "3 dashes", name: "cardamom bitters" },
        { amount: "", name: "A little soda, to taste" },
        { amount: "½ oz", name: "lime juice" },
        { amount: "1/2 oz", name: "lemon juice" },
      ],
    });
    await page.getByRole("tab").first().click();
    await page.getByRole("tab", { name: "MJ Personal Version" }).click();
    await expect(page.locator("#specIngredients")).toHaveValue(lines);
    expect(dialogs).toEqual([]);
  });
}

test("uploaded version photos survive later edits and old metadata is retained", async ({ page }) => {
  const key = await openPersonal(page);
  await page.locator("#specPhoto").setInputFiles({
    name: "my-drink.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII=", "base64"),
  });
  await page.locator("#spec-note").fill("My own variation");
  await page.locator('[data-action="save-my-recipe"]').click();
  await expect(page.locator('[data-action="save-my-recipe"]')).toHaveText("Saved");
  const first = await savedSpec(page, key);
  expect(first.photo).toMatch(/^data:image\/jpeg;base64,/);
  expect(first.ingredients).toEqual([]);
  await page.evaluate((k) => {
    const spec = JSON.parse(localStorage.getItem(k));
    spec.legacyMetadata = "keep me";
    localStorage.setItem(k, JSON.stringify(spec));
  }, key);
  await page.getByRole("tab").first().click();
  await page.getByRole("tab", { name: "MJ Personal Version" }).click();
  await expect(page.getByAltText("Your saved version photograph")).toBeVisible();
  await page.locator("#spec-note").fill("Updated notes without another upload");
  await page.locator('[data-action="save-my-recipe"]').click();
  await expect(page.locator('[data-action="save-my-recipe"]')).toHaveText("Saved");
  expect(await savedSpec(page, key)).toMatchObject({
    photo: first.photo,
    legacyMetadata: "keep me",
    note: "Updated notes without another upload",
  });
});

test("failed storage writes leave the existing recipe and current draft intact", async ({ page }) => {
  const key = await openPersonal(page);
  await page.locator("#spec-note").fill("Original saved notes");
  await page.locator('[data-action="save-my-recipe"]').click();
  await expect(page.locator('[data-action="save-my-recipe"]')).toHaveText("Saved");
  const original = await savedSpec(page, key);
  await page.evaluate((k) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, key);
  const dialogs = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.locator("#spec-note").fill("Keep this draft available");
  await page.locator('[data-action="save-my-recipe"]').click();
  await expect(page.locator('[data-action="save-my-recipe"]')).toHaveText("Save my recipe");
  await expect(page.locator("#spec-note")).toHaveValue("Keep this draft available");
  expect(await savedSpec(page, key)).toEqual(original);
  expect(dialogs).toEqual([expect.stringContaining("storage is full or unavailable")]);
});

test("social versions can be saved with only notes and an informal source", async ({ page }) => {
  const key = await openPersonal(page);
  await page.getByRole("tab", { name: "+ Social recipe", exact: true }).click();
  const dialogs = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.locator("#spec-note").fill("A friend's variation to try later");
  await page.locator("#socialUrl").fill("instagram.com/my-friend");
  await page.locator('[data-action="save-social"]').click();
  await expect(page.locator("#versionPane")).toContainText("A friend's variation to try later");
  const saved = await savedSpec(page, key.replace("shakerrr_my_", "shakerrr_social_"));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ ingredients: [], instructions: "", url: "instagram.com/my-friend" });
  expect(dialogs).toEqual([]);
});
