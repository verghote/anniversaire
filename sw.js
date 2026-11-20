"use strict";

// -----------------------------------------------------------------------------------
// Import des fonctions nécessaires
// -----------------------------------------------------------------------------------
// Le Service Worker n'utilise aucune bibliothèque externe.

// -----------------------------------------------------------------------------------
// Déclaration des variables globales
// -----------------------------------------------------------------------------------
const CACHE_NAME = "anniversaires-pwa-cache-v4";
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

// -----------------------------------------------------------------------------------
// Procédures évènementielles
// -----------------------------------------------------------------------------------

// Précharge les ressources de l'application et les bibliothèques accessibles.
function handleInstall(event) {
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
}

// Supprime uniquement les anciennes versions du cache de cette application.
function handleActivate(event) {
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
}

// Sert les ressources depuis le cache et actualise les données initiales en réseau.
function handleFetch(event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Les fichiers de données initiales doivent être actualisés depuis le serveur.
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith("/anniversaires.json") || url.pathname.endsWith("/contact.json"))) {
    event.respondWith(
        fetch(event.request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          }
          return response;
        }).catch(async (error) => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw error;
        })
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
}

// -----------------------------------------------------------------------------------
// Fonctions de traitement
// -----------------------------------------------------------------------------------
// Les traitements du cache sont intégrés aux procédures ci-dessus.

// -----------------------------------------------------------------------------------
// Programme principal
// -----------------------------------------------------------------------------------
self.addEventListener("install", handleInstall);
self.addEventListener("activate", handleActivate);
self.addEventListener("fetch", handleFetch);