import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const args = process.argv.slice(2);
const root = path.resolve(args.includes("--production") ? "_site" : ".");
const portFlag = args.indexOf("--port");
const port = Number(
  portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 5173,
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    // Simulate the GitHub project URL as well as ordinary root hosting.
    if (pathname.startsWith("/HomeGenie/"))
      pathname = pathname.slice("/HomeGenie".length);
    if (pathname.endsWith("/")) pathname += "index.html";
    if (pathname !== "/index.html" && !pathname.startsWith("/assets/")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`HomeGenia available on port ${port} (root and /HomeGenie/)`),
);
