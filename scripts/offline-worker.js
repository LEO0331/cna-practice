/* global self, caches */
// The build replaces this marker with a content-versioned manifest.
/* OFFLINE_MANIFEST */

const scope = new URL(self.registration.scope);
const cachePrefix = `cna-offline-${encodeURIComponent(scope.pathname)}-`;
const cacheName = `${cachePrefix}${OFFLINE_VERSION}`;
const urls = OFFLINE_FILES.map((file) => new URL(file, scope).href);
const knownUrls = new Set(urls);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      // Bound parallel downloads so background caching does not flood mobile connections.
      for (let index = 0; index < urls.length; index += 8) {
        await cache.addAll(urls.slice(index, index + 8).map((url) => new Request(url, { cache: "reload" })));
      }
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // Exported HTML and RSC payloads are static: filter/prefetch query strings
  // do not change their bytes. Keep .txt paths separate from document paths.
  url.search = "";
  url.hash = "";
  if (!knownUrls.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url.href, { ignoreVary: true });
    return cached ?? fetch(event.request);
  })());
});
