importScripts("./app-info.js");

const CACHE_PREFIX = "impostor-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${self.IMPOSTOR_INFO.version}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./game.js",
  "./words.js",
  "./storage.js",
  "./app-shell.js",
  "./app-info.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];
const coreURLs = new Set(CORE_ASSETS.map((path) => new URL(path, self.registration.scope).href));
const indexURL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  // A failed addAll rejects installation and leaves the active worker and its cache intact.
  // Activation is requested by the app only after a round, never during installation.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  if (request.mode === "navigate") {
    // Serve one complete, installed version until the user accepts the next one.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => (await cache.match(indexURL)) || fetch(request))
    );
  } else if (coreURLs.has(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => (await cache.match(request)) || fetch(request))
    );
  }
});
