import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

export async function readAsset(pathname) {
  const file = resolve(root, `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`);
  if (!file.startsWith(root + sep)) throw new Error("Invalid path");
  return { body: await readFile(file), type: types[extname(file)] || "application/octet-stream" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  http
    .createServer(async (request, response) => {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405);
        return response.end();
      }
      try {
        const asset = await readAsset(new URL(request.url, "http://localhost").pathname);
        response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : asset.body);
      } catch {
        response.writeHead(404);
        response.end("Fant ikke siden.");
      }
    })
    .listen(port, "127.0.0.1", () => console.log(`Impostor: http://127.0.0.1:${port}`));
}
