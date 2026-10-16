# HomeGenia by SECHA

Responsive interior and renovation marketplace concept built with React and Vite. Inter fonts and imagery are bundled locally.

## Development

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

## Production

```sh
npm run build
npm run preview
```

Includes service category filters, session favorites, location selection, and a guided Genie assistant with room/budget recommendations. The assistant uses local scripted responses; booking, live inventory, real customer reviews, and an AI backend are not connected. Prices and social proof are illustrative content.

Photography sourced from the freely reusable [Woodex demo assets](https://github.com/codewithsadee/woodex). Replace with SECHA’s licensed project photos before launch.

## Deployment and blank-page troubleshooting

The repository's `index.html` is a Vite source entry. Browsers and plain static hosts cannot run its JSX directly. Use `npm run dev` for development, or deploy the **contents of `dist/` after `npm run build`**. Do not serve the repository root as the production site.

The included GitHub Actions workflow builds and deploys `dist/` on pushes to `main`. For GitHub Pages, set **Settings → Pages → Build and deployment → Source → GitHub Actions**. The project URL is `https://jplovensa.github.io/HomeGenie/` after the deployment succeeds. Built assets and images use relative paths so both root hosting and the `/HomeGenie/` project path work.

To check the production build locally, run `npm run build` followed by `npm run preview`. Open the HTTP address printed by Vite, rather than double-clicking an HTML file.
