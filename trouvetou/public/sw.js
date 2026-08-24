const CACHE_NAME = "trouvetou-v1";
const STATIC_ASSETS = ["/", "/ecoles", "/cliniques", "/hotels", "/restaurants"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // On ne cache que les navigations (HTML) et les assets statiques.
  // Les API Supabase ne sont pas mises en cache (données fraîches).
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Mise en cache stale-while-revalidate pour les pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetched = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);

        return cached ?? fetched;
      })
    );
    return;
  }

  // Cache-first pour les assets statiques (images, CSS, JS)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.hostname === "images.unsplash.com"
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
            return response;
          })
      )
    );
  }
});
