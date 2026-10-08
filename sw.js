const CACHE = "shakerrr-v20261008-visible-photos";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./src/core.js",
  "./src/storage.js",
  "./src/content.js",
  "./src/photos.js",
  "./src/catalog-model.js",
  "./src/catalog-bootstrap.js",
  "./data/recipes.json",
  "./data/collections.json",
  "./data/world.json",
  "./data/image-manifest.json",
  "./data/catalog-meta.json",
  "./manifest.webmanifest",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          CORE.map(
            (url) =>
              new Request(new URL(url, self.registration.scope), {
                cache: "reload",
              }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("shakerrr-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE).catch(() => null);
      try {
        // Revalidate the application and manifest rather than reusing stale HTTP cache.
        const response = await fetch(event.request, { cache: "no-cache" });
        const isHTML = response.headers
          .get("content-type")
          ?.includes("text/html");
        if (
          response.ok &&
          (!isHTML ||
            event.request.mode === "navigate" ||
            /\/(?:index\.html)?$/.test(url.pathname))
        )
          await cache?.put(event.request, response.clone()).catch(() => {});
        return response;
      } catch {
        const cached = await cache?.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const shell = await cache?.match(
            new URL("index.html", self.registration.scope),
          );
          if (shell) return shell;
        }
        // Never return HTML as a photograph, script or JSON manifest.
        return new Response("Unavailable offline", {
          status: 503,
          headers: { "content-type": "text/plain" },
        });
      }
    })(),
  );
});
