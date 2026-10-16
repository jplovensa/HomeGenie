import { cp, mkdir, rm } from "node:fs/promises";
await rm("_site", { recursive: true, force: true });
await mkdir("_site");
for (const file of ["index.html", "assets", ".nojekyll"]) {
  await cp(file, `_site/${file}`, { recursive: true });
}
console.log(
  "Static site copied to _site/. The same index.html and assets/ also work directly from the repository root.",
);
