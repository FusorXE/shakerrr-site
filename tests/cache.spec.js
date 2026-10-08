import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("new service worker replaces old app cache, preserves personal data, and works offline", async ({
  page,
  context,
}) => {
  // A dedicated server can be shut down to guarantee worker fetches also go offline.
  const server = createServer(async (req, res) => {
    const name =
      new URL(req.url, "http://localhost").pathname.replace(
        /^\/shakerrr-site\//,
        "",
      ) || "index.html";
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".json": "application/json",
      ".webmanifest": "application/json",
      ".css": "text/css",
      ".webp": "image/webp",
    };
    try {
      res.setHeader(
        "content-type",
        mime[path.extname(name)] || "application/octet-stream",
      );
      res.end(await readFile(path.resolve(name)));
    } catch {
      res.writeHead(404);
      res.end("Missing");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}/shakerrr-site`;
  try {
    await page.goto(origin + "/manifest.webmanifest");
    await page.evaluate(async () => {
      await caches.open("shakerrr-v-old");
      await caches.open("unrelated-app");
      localStorage.setItem(
        "shakerrr_my_negroni",
        JSON.stringify({ note: "My original recipe" }),
      );
      localStorage.setItem("shakerrr_favs", JSON.stringify(["negroni"]));
    });
    await page.goto(origin + "/");
    await expect(page.locator(".card").first()).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).not.toContain("shakerrr-v-old");
    expect(keys).toContain("unrelated-app");
    await page.locator("#searchInput").fill("Negroni");
    await page.locator('.search-item[data-recipe="negroni"]').click();
    const img = page.locator(".detail-photo img");
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".card").first()).toBeVisible();
    await page.locator("#searchInput").fill("Negroni");
    await page.locator('.search-item[data-recipe="negroni"]').click();
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator(".detail-photo .photo-status")).toBeHidden();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("shakerrr_my_negroni")).note,
      ),
    ).toBe("My original recipe");
    const missing = await page.evaluate(async () => {
      const r = await fetch("assets/recipes/not-cached.webp");
      return {
        status: r.status,
        type: r.headers.get("content-type"),
        body: await r.text(),
      };
    });
    expect(missing.status).toBe(503);
    expect(missing.type).toBe("text/plain");
    expect(missing.body).not.toContain("<html");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("failed HTTP asset responses are not cached", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card").first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const result = await page.evaluate(async () => {
    const url = "assets/recipes/missing-test.webp";
    const r = await fetch(url);
    return { status: r.status, cached: !!(await caches.match(url)) };
  });
  expect(result).toEqual({ status: 404, cached: false });
});
