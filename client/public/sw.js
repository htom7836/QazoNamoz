const CACHE_NAME = "qazo-namoz-shell-v1";
const SHELL_URL = "/";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(SHELL_URL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("qazo-namoz-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers.has("authorization")
    || url.pathname.startsWith("/api/") || url.pathname.startsWith("/__")
    || url.pathname.startsWith("/manus-oauth/") || url.pathname.startsWith("/manus-storage/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === "navigate") {
      if (url.pathname !== "/" && url.pathname !== "/404") return fetch(request);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(SHELL_URL, response.clone());
        return response;
      } catch {
        return (await cache.match(SHELL_URL)) || Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
