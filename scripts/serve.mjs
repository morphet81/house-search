#!/usr/bin/env node
/**
 * Local results browser (mirrors GitHub Pages layout).
 *
 *   npm run serve
 *   node scripts/serve.mjs [--port=3456] [--open]
 *
 * Serves repo root so /web/* and /output/* match static hosting.
 * Does not open a browser unless --open is passed.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  let port = 3456;
  let openBrowser = false;
  for (const a of argv) {
    if (a.startsWith("--port=")) port = Number(a.slice(7)) || port;
    if (a === "--open") openBrowser = true;
  }
  return { port, openBrowser };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".geojson": "application/geo+json; charset=utf-8",
      ".kml": "application/vnd.google-earth.kml+xml; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream"
  );
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const full = path.normalize(path.join(base, decoded));
  if (!full.startsWith(base)) return null;
  return full;
}

function openUrl(url) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const { port, openBrowser } = parseArgs(process.argv.slice(2));

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  let pathname = url.pathname;

  // Convenience: local / and /web mount the same app as GitHub Pages /web/
  if (pathname === "/" || pathname === "/index.html") {
    sendFile(res, path.join(root, "web", "index.html"));
    return;
  }

  if (pathname === "/web" || pathname === "/web/") {
    sendFile(res, path.join(root, "web", "index.html"));
    return;
  }

  // Allow /listings.html etc. (local shortcut) and /web/listings.html (Pages-like)
  if (
    pathname === "/listings.html" ||
    pathname === "/map.html" ||
    pathname === "/filter-stations.html" ||
    pathname === "/styles.css" ||
    pathname === "/site.js"
  ) {
    pathname = `/web${pathname}`;
  }

  const filePath = safeJoin(root, pathname);
  if (!filePath) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    if (fs.existsSync(indexPath)) {
      sendFile(res, indexPath);
      return;
    }
  }

  sendFile(res, filePath);
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`House search results → ${url}`);
  console.log(`Pages-like URL → http://127.0.0.1:${port}/web/`);
  if (openBrowser) openUrl(url);
});
