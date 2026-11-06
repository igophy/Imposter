import http from "node:http";
import { readAsset } from "../../scripts/serve.js";

export async function newGroup(page, count = 4, imposters = 1, names = []) {
  await page.locator("#playerCount").fill(String(count));
  await page.locator("#imposterCount").fill(String(imposters));
  await page.locator("#categorySelect").selectOption("Ting");
  await page.locator("#goToNamesBtn").click();
  for (let i = 0; i < names.length; i++) await page.locator(`#player-${i}`).fill(names[i]);
  await page.locator("#startGameBtn").click();
}

export async function dealRoles(page, count = 4) {
  const imposters = [];
  let word;
  for (let i = 0; i < count; i++) {
    await page.locator("#confirmPlayerBtn").click();
    await page.locator("#toggleRevealBtn").click();
    const secret = (await page.locator("#secretBox .secret-word").innerText()).toLocaleUpperCase(
      "nb-NO"
    );
    if (secret === "IMPOSTOR") imposters.push(i);
    else word = secret;
    await page.locator("#toggleRevealBtn").click();
    await page.locator("#nextPlayerBtn").click();
  }
  return { imposters, word };
}

export async function testSite({ legacy = false } = {}) {
  let version = "1";
  let failAsset = null;
  const prefix = "/Imposter/";
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404);
      return response.end();
    }
    const resource = "/" + pathname.slice(prefix.length);
    if (resource === failAsset) {
      response.writeHead(503);
      return response.end("Simulated failed asset");
    }
    try {
      const asset = await readAsset(resource);
      let body = asset.body;
      if (legacy && ["/", "/index.html"].includes(resource))
        body =
          '<!doctype html><title>Legacy Impostor</title><p>Gammel appversjon</p><script>navigator.serviceWorker.register("./sw.js");navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload())</script>';
      if (legacy && resource === "/sw.js")
        body = `
        const CACHE = "impostor-shell-legacy";
        self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["./", "./index.html"])).then(() => self.skipWaiting())));
        self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
        self.addEventListener("fetch", event => {
          if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
        });
      `;
      if (resource === "/app-info.js")
        body = String(body).replace(/version: "[^"]+"/, `version: "test-${version}"`);
      // A unique top-level source also makes update checks deterministic across browsers.
      if (resource === "/sw.js") body = String(body) + `\n// test deployment ${version}\n`;
      response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    deploy(next, failing = null) {
      version = next;
      failAsset = failing;
      legacy = false;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
