# HomeGenie by SECHA

A static, responsive interior-service storefront with a server-side **Midtrans Snap** checkout integration. The storefront works on GitHub Pages without a build or runtime dependencies. Payment credentials stay on a separate Node server.

## What works

- Six service packages with scope, exclusions, price, and timelines.
- Search, categories, price sorting, saved services, and guided Genie recommendations.
- A persistent cart, quantities, server-calculated totals, and project/customer checkout details.
- Midtrans-hosted payments, signed order references, and payment-status verification.
- Mobile navigation, keyboard-accessible dialogs, local Inter fonts and images, and a homepage visible without JavaScript.

**Payments are not activated by committing this repository.** The Pages storefront explicitly leaves payment unavailable until a payment API URL is configured. A Midtrans account and its server key are required. Prices, package scope, service availability, and policy copy are initial business content and should be confirmed by SECHA before production checkout is enabled.

## GitHub Pages storefront

Both `main` → `/ (root)` branch hosting and the included GitHub Actions workflow work. The workflow runs all tests and publishes `_site/`, which contains the same static HTML and assets as the repository root.

Storefront: https://jplovensa.github.io/HomeGenie/

## Activate Midtrans on Render

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/jplovensa/HomeGenie). The included `render.yaml` prepares a Node web service with a free plan, health check, and generated order-signing secret.
2. In Render's secure environment settings, enter the **sandbox server key** from your Midtrans account as `MIDTRANS_SERVER_KEY`. Never put it in Git, `assets/config.js`, or chat. Leave `MIDTRANS_IS_PRODUCTION=false` for testing.
3. After deployment, check `https://YOUR-SERVICE.onrender.com/api/health`. It should report `configured: true` and `mode: sandbox`. Free Render services may need time to wake up after inactivity.
4. In `assets/config.js`, set `commerceApiUrl` to `https://YOUR-SERVICE.onrender.com/api`, then bump the `config.js?v=...` version in `index.html`, commit, and deploy the storefront. Use the real assigned Render URL, not a guessed hostname. `SITE_URL` and the allowed storefront origin are already set to the GitHub Pages site in the blueprint.
5. Run a complete Midtrans sandbox purchase using Midtrans test payment instructions. Verify the total, customer/project details, receipt return, and status in the Midtrans dashboard. This has **not** been performed without a merchant account/key.
6. After merchant onboarding and testing, put the production server key in Render and set `MIDTRANS_IS_PRODUCTION=true`. Never use sandbox payment methods with a production key.

Render can also serve the entire storefront at its own root. In that case set `SITE_URL` to that storefront address so the receipt returns there. On the Node host, `assets/config.js` automatically points at its own `/api` routes.

### Order management and limitations

Midtrans is the transaction system of record. The merchant team uses the Midtrans dashboard to review payments and coordinate services; there is no separate inventory, merchant admin dashboard, automated scheduling/email, database, or automated fulfillment in this repository. Service IDs, quantities, customer details, project location, preferred date, and notes are included in the Midtrans transaction. Customer notes are limited to 255 characters.

The return URL contains a signed reference with an order ID, amount, and expiration; it contains no customer details. Payment is marked confirmed only after a server-side Midtrans status lookup reports settlement or an accepted capture, and the order ID and amount match. Pending, failed, challenged, and refunded states are kept distinct. Do not fulfill an order just because a browser visited a success URL. For fulfillment outside this application, independently verify the transaction in Midtrans or implement a signed notification handler and durable order database.

The server ignores client-supplied prices, rejects duplicate service IDs and invalid quantities, validates project details, restricts browser origins, limits request size and checkout rate, and returns no secret values. Retry requests for the same checkout ID use the same Midtrans order ID to prevent duplicate transaction creation; a duplicate returns an explicit error rather than pretending a payment succeeded.

## Local development

Node 18+ is enough. No dependency installation is required.

```sh
npm run dev -- --port 5173
npm test
```

Open `http://localhost:5173/` or `http://localhost:5173/HomeGenie/`. Without Midtrans configuration the server returns an explicit payment-unavailable response; browsing, carts, and recommendations continue working.

To test against your merchant sandbox, set the variables in `.env.example` using your shell/host's secure configuration. On Node 22 you can use a locally created, ignored `.env` file:

```sh
node --env-file=.env scripts/serve.mjs --port 5173
```

Generate `ORDER_SIGNING_SECRET` using a cryptographically random secret of at least 32 characters. `.env` is ignored. Never share or commit it.

```sh
npm run build       # Copies only the static storefront to _site/
npm run preview     # Serves that copy and the commerce API locally
npm start           # Runs the storefront and API on PORT (default 3000)
```

`npm test` runs static deployment checks and server integration tests with **mock Midtrans responses**. It does not charge money or validate merchant credentials. Browser checks cover both root and project-subdirectory hosting, including the no-JavaScript homepage.

## Assets

Photos: [Woodex demo assets](https://github.com/codewithsadee/woodex). Replace them with licensed SECHA project photography before launch. Inter's font license is in `assets/fonts/OFL.txt`. Icons are inline SVG. No external font, icon, or image service is required.
