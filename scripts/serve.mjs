#!/usr/bin/env node
/**
 * Local results browser.
 *
 *   npm run serve
 *   node scripts/serve.mjs [--port=3456] [--open]
 *
 * Serves web/ + output/. Landing page links to each property-type
 * result file found under output/*.json.
 * Does not open a browser unless --open is passed.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const webDir = path.join(root, "web");
const outputDir = path.join(root, "output");

const TYPE_META = {
  kodate: { label: "一戸建て", labelEn: "Detached house", deal: "buy" },
  mansion: { label: "マンション", labelEn: "Apartment", deal: "buy" },
  tochi: { label: "土地", labelEn: "Land", deal: "buy" },
  kodate_rent: { label: "一戸建て", labelEn: "Detached house", deal: "rent" },
  mansion_rent: { label: "マンション", labelEn: "Apartment", deal: "rent" },
};

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
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream"
  );
}

function listResultFiles() {
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const type = path.basename(f, ".json");
      const full = path.join(outputDir, f);
      let count = null;
      let scrapedAt = null;
      let deal = TYPE_META[type]?.deal || null;
      try {
        const data = JSON.parse(fs.readFileSync(full, "utf8"));
        count = Array.isArray(data.listings) ? data.listings.length : data.count ?? null;
        scrapedAt = data.scrapedAt ?? null;
        if (data.deal) deal = data.deal;
      } catch {
        /* ignore */
      }
      const meta = TYPE_META[type] || { label: type, labelEn: type, deal: deal || "buy" };
      return {
        type,
        file: f,
        label: meta.label,
        labelEn: meta.labelEn,
        deal: deal || meta.deal || "buy",
        count,
        scrapedAt,
        jsonUrl: `/output/${encodeURIComponent(f)}`,
        pageUrl: `/listings.html?type=${encodeURIComponent(type)}`,
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type));
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(raw);
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
  const pathname = url.pathname;

  if (pathname === "/api/results") {
    sendJson(res, 200, { results: listResultFiles() });
    return;
  }

  if (pathname.startsWith("/output/")) {
    const filePath = safeJoin(outputDir, pathname.slice("/output/".length));
    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    sendFile(res, filePath);
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    sendFile(res, path.join(webDir, "index.html"));
    return;
  }

  const webPath = safeJoin(webDir, pathname);
  if (webPath) {
    sendFile(res, webPath);
    return;
  }

  res.writeHead(404).end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`House search results → ${url}`);
  console.log(`Serving output from ${outputDir}`);
  if (openBrowser) openUrl(url);
});
