const CACHE_NAME = "anniversaires-pwa-cache-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./index.css",
  "./index.js",
  "./contact.html",
  "./anniversaire/",
  "./anniversaire/index.html",
  "./anniversaire/index.js",
  "./anniversaire/style.css",
  "./contact/",
  "./contact/index.html",
  "./contact/index.js",
  "./contact/style.css",
  "./contact/tailwind-config.js",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (_) {
            // Ignore si une ressource externe échoue lors de l'installation
          }
        }
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
      caches.keys().then((keys) =>
          Promise.all(
              keys
                  .filter((key) => key.startsWith("anniversaires-pwa-cache-") && key !== CACHE_NAME)
                  .map((key) => caches.delete(key))
          )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Toujours tenter le réseau en priorité pour anniversaires.json
  if (url.origin === self.location.origin && url.pathname.endsWith("/anniversaires.json")) {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
  );
});