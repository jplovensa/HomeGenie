import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCommerceHandler } from "./commerce.mjs";
export function createAppServer({
  root = process.cwd(),
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const commerce = createCommerceHandler({ env, fetchImpl, now });
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
  };
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith("/HomeGenie/"))
        pathname = pathname.slice("/HomeGenie".length);
      if (await commerce(req, res, pathname, url)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }
      if (pathname.endsWith("/")) pathname += "index.html";
      if (pathname !== "/index.html" && !pathname.startsWith("/assets/")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      // On the Node host the same server supplies payments; on Pages this file is static.
      if (pathname === "/assets/config.js") {
        res.writeHead(200, {
          "Content-Type": types[".js"],
          "Cache-Control": "no-store",
        });
        res.end(
          "window.HOMEGENIE_CONFIG = Object.freeze(" +
            JSON.stringify({ commerceApiUrl: env.COMMERCE_API_URL || "/api" }) +
            ");",
        );
        return;
      }
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(path.resolve(root) + path.sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end("Not found");
    }
  });
}
