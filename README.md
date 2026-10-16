# HomeGenia by SECHA

A responsive interior and renovation marketplace concept using static HTML, CSS, and JavaScript. There are no runtime or build dependencies. All page content is present in `index.html` before JavaScript runs, and all photos, icons, and Inter fonts are local.

## GitHub Pages

The repository root is the deployable website. Both supported Pages modes work:

- **Deploy from a branch:** Settings → Pages → Source → Deploy from a branch → `main` → `/ (root)`.
- **GitHub Actions:** Settings → Pages → Source → GitHub Actions. The included workflow copies the static site into `_site/` and deploys it.

The website URL is `https://jplovensa.github.io/HomeGenie/`. All resources use relative URLs, so project hosting and custom domains work. `.nojekyll` prevents unnecessary Jekyll processing. No JSX, Node modules, CDN, or transformation is needed to serve the site.

## Local development

With Node 18 or later:

```sh
npm run dev
```

Open `http://localhost:5173/` or `http://localhost:5173/HomeGenie/`. No `npm install` is needed. Alternatively, any static HTTP server can serve the repository root.

Optional production packaging:

```sh
npm run build
npm run preview
```

The build only copies `index.html`, `assets/`, and `.nojekyll` into `_site/`.

## Features and scope

Service category filters, favorites retained in browser storage when available, location selection, responsive navigation, and a keyboard-accessible Genie room/budget planning flow. Text-only chat replies are scripted suggestions; live AI, booking, inventory, and authentication are not connected. Prices and social proof are illustrative.

Photography is from the freely reusable [Woodex demo assets](https://github.com/codewithsadee/woodex). Replace with SECHA project photography before launch. Inter's license is included in `assets/fonts/OFL.txt`.
