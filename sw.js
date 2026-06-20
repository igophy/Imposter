/* sw.js
 * Robust, enkel service worker for statisk webapp/PWA.
 * Legg denne ved siden av index.html, eller i public/ slik at den havner i rot etter build.
 */

const CACHE_VERSION = "2026.06.20-1";
const CACHE_NAME = `app-shell-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./pwa.css",
  "./pwa-app-shell.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

const STATIC_ASSET_RE = /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf)$/i;

function shouldBypass(request) {
  if (request.method !== "GET") return true;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return true;

  // Ikke cache API/admin/feedback eller andre dynamiske endepunkter.
  if (
    url.pathname.includes("/api/") ||
    url.pathname.includes("/admin/") ||
    url.pathname.includes("/feedback") ||
    url.pathname.includes("/tilbakemelding")
  ) {
    return true;
  }

  return false;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (shouldBypass(request)) return;

  const url = new URL(request.url);

  // Navigasjon: prøv nett først, fallback til cache.
  // Dette gjør at nye deploys normalt blir plukket opp.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match("./index.html");
        })
    );
    return;
  }

  // Statiske filer: stale-while-revalidate.
  if (STATIC_ASSET_RE.test(url.pathname) || url.pathname.endsWith("manifest.webmanifest")) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        const fetchPromise = fetch(request, { cache: "no-store" })
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});
