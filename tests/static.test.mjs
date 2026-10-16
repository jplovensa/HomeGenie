import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Script } from "node:vm";
import path from "node:path";
const html = await readFile("index.html", "utf8");

test("homepage is real HTML without a JavaScript rendering dependency", () => {
  assert.match(html, /<h1[\s>]/);
  assert.match(html, /A little magic/);
  assert.match(html, /data-category="Kitchen makeover"/);
  assert.match(html, /class="service-card"/);
  assert.doesNotMatch(html, /\/src\/|\.jsx|@vite|type="module"/);
});

test("every local HTML asset uses a project-safe relative path and exists", async () => {
  const paths = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith("#"));
  assert(paths.length >= 7);
  for (const asset of paths) {
    assert(asset.startsWith("./assets/"), `Unexpected asset path: ${asset}`);
    await access(asset);
  }
});

test("font files referenced in CSS are local and available", async () => {
  const css = await readFile("assets/styles.css", "utf8");
  const urls = [...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(
    (match) => match[1],
  );
  assert.equal(urls.length, 4);
  for (const url of urls) await access(path.resolve("assets", url));
});

test("browser enhancement script is valid standalone JavaScript", async () => {
  const source = await readFile("assets/app.js", "utf8");
  assert.doesNotThrow(() => new Script(source));
  assert.doesNotMatch(source, /^import\s/m);
});

test("production package contains the exact root website", async () => {
  for (const file of [
    "index.html",
    "assets/app.js",
    "assets/styles.css",
    ".nojekyll",
  ]) {
    assert.deepEqual(await readFile(file), await readFile(`_site/${file}`));
  }
});
