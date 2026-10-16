import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Script } from "node:vm";
import path from "node:path";
const html = await readFile("index.html", "utf8");
const catalog = JSON.parse(await readFile("assets/catalog.json", "utf8"));
test("homepage contains the complete HomeGenie storefront without runtime rendering", () => {
  assert.match(html, /<h1[\s>]/);
  assert.match(html, /HomeGenie/);
  assert.doesNotMatch(
    html,
    /HomeGenia|homegenia|\/src\/|\.jsx|@vite|type="module"/,
  );
  for (const p of catalog) {
    assert(html.includes(`data-product="${p.id}"`));
    assert(html.includes(p.name));
    assert(html.includes(`data-price="${p.price}"`));
  }
});
test("all HTML assets have project-safe relative paths and exist", async () => {
  const paths = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map(
    (m) => m[1],
  );
  assert(paths.length >= 10);
  for (const file of paths) {
    assert(file.startsWith("./assets/"), file);
    await access(file.split("?")[0]);
  }
});
test("every catalog image and CSS font is bundled locally", async () => {
  const css = await readFile("assets/styles.css", "utf8");
  const fonts = [...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(
    (m) => m[1],
  );
  assert.equal(fonts.length, 4);
  for (const font of fonts) await access(path.resolve("assets", font));
  for (const p of catalog) await access("assets/images/" + p.image);
});
test("cart and configuration scripts are standalone JavaScript", async () => {
  for (const file of ["assets/app.js", "assets/config.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotThrow(() => new Script(source));
    assert.doesNotMatch(source, /^import\s/m);
  }
});
test("Pages artifact exactly matches root HTML, scripts, styles, and catalog", async () => {
  for (const file of [
    "index.html",
    "assets/app.js",
    "assets/config.js",
    "assets/styles.css",
    "assets/catalog.json",
    ".nojekyll",
  ])
    assert.deepEqual(await readFile(file), await readFile("_site/" + file));
});
