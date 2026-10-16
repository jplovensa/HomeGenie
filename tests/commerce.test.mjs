import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCheckout,
  signReference,
  verifyReference,
  paymentStatus,
  catalog,
} from "../server/commerce.mjs";
import { createAppServer } from "../server/app.mjs";
const now = Date.parse("2026-10-16T10:00:00Z");
const secret = "test-only-signing-secret-at-least-32-characters";
const env = {
  MIDTRANS_SERVER_KEY: "test-only-midtrans-fixture",
  ORDER_SIGNING_SECRET: secret,
  SITE_URL: "https://jplovensa.github.io/HomeGenie/",
  ALLOWED_ORIGINS: "http://localhost:5173",
};
const fixture = () => ({
  checkoutId: "9b99bdcb-0b90-4c52-9081-11d55bf92fad",
  items: [{ id: "design-consultation", quantity: 2, price: 1 }],
  customer: {
    name: "Test Customer",
    email: "customer@example.com",
    phone: "+62 812 3456 7890",
    city: "Jakarta",
    date: "2026-10-20",
    address: "Example street 10",
    notes: "Warm natural colours",
    terms: "on",
  },
});
const mockResponse = (data) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
async function serve(t, options = {}) {
  const server = createAppServer({ env, now: () => now, ...options });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((r) => server.close(r));
  });
  return "http://127.0.0.1:" + server.address().port;
}
test("server computes totals from canonical prices, ignoring submitted prices", () => {
  const order = validateCheckout(fixture(), now);
  assert.equal(order.total, catalog[0].price * 2);
  assert.equal(order.items[0].price, 350000);
  assert.match(order.orderId, /^HG-[a-f0-9]{32}$/);
});
test("invalid IDs, duplicates, quantities, consent, and dates fail validation", () => {
  for (const mutate of [
    (f) => (f.items[0].id = "unknown"),
    (f) => (f.items[0].quantity = 0),
    (f) => (f.items[0].quantity = -1),
    (f) => (f.items[0].quantity = 6),
    (f) => (f.items[0].quantity = "2"),
    (f) => f.items.push({ ...f.items[0] }),
    (f) => (f.customer.terms = false),
    (f) => (f.customer.date = "2026-10-15"),
    (f) => (f.customer.date = "2026-99-99"),
    (f) => (f.customer.date = "2026-02-31"),
    (f) => (f.customer.email = "bad-email"),
    (f) => (f.customer.city = "Unsupported"),
    (f) => (f.customer.notes = "x".repeat(256)),
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(
      () => validateCheckout(input, now),
      (error) => error.status === 400,
    );
  }
});
test("signed order references reject tampering and expiration", () => {
  const order = validateCheckout(fixture(), now);
  const reference = signReference(order, secret, now);
  assert.equal(verifyReference(reference, secret, now).total, 700000);
  assert.throws(() => verifyReference(reference + "0", secret, now));
  assert.throws(() => verifyReference(reference, secret, now + 31 * 86400000));
  assert.throws(() => verifyReference(reference, "a-different-secret", now));
});
test("only verified settlement or accepted capture counts as paid", () => {
  const order = validateCheckout(fixture(), now);
  const transaction = {
    order_id: order.orderId,
    gross_amount: "700000.00",
    currency: "IDR",
  };
  assert.equal(
    paymentStatus({ ...transaction, transaction_status: "settlement" }, order),
    "paid",
  );
  assert.equal(
    paymentStatus(
      { ...transaction, transaction_status: "capture", fraud_status: "accept" },
      order,
    ),
    "paid",
  );
  assert.equal(
    paymentStatus(
      {
        ...transaction,
        transaction_status: "capture",
        fraud_status: "challenge",
      },
      order,
    ),
    "review",
  );
  assert.equal(
    paymentStatus({ ...transaction, transaction_status: "pending" }, order),
    "pending",
  );
  assert.equal(
    paymentStatus({ ...transaction, transaction_status: "expire" }, order),
    "failed",
  );
  assert.equal(
    paymentStatus({ ...transaction, transaction_status: "refund" }, order),
    "refunded",
  );
  assert.throws(() =>
    paymentStatus(
      { ...transaction, gross_amount: "1", transaction_status: "settlement" },
      order,
    ),
  );
  assert.throws(() =>
    paymentStatus(
      { ...transaction, order_id: "other", transaction_status: "settlement" },
      order,
    ),
  );
});
test("checkout creates Midtrans hosted transaction with server prices and signed return URL", async (t) => {
  let request;
  const base = await serve(t, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return mockResponse({
        redirect_url:
          "https://app.sandbox.midtrans.com/snap/v4/redirection/test-token",
      });
    },
  });
  const response = await fetch(base + "/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://jplovensa.github.io",
    },
    body: JSON.stringify(fixture()),
  });
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.total, 700000);
  assert.equal(data.mode, "sandbox");
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://jplovensa.github.io",
  );
  assert.equal(
    request.url,
    "https://app.sandbox.midtrans.com/snap/v1/transactions",
  );
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.transaction_details.gross_amount, 700000);
  assert.equal(payload.item_details[0].price, 350000);
  assert.equal(payload.customer_details.email, "customer@example.com");
  const callback = new URL(payload.callbacks.finish);
  assert.equal(callback.pathname, "/HomeGenie/");
  assert.equal(callback.searchParams.get("order"), data.reference);
  assert(!JSON.stringify(data).includes(env.MIDTRANS_SERVER_KEY));
});
test("invalid carts and unauthorized origins never reach Midtrans", async (t) => {
  let calls = 0;
  const base = await serve(t, {
    fetchImpl: async () => {
      calls++;
      return mockResponse({});
    },
  });
  const invalid = fixture();
  invalid.items[0].quantity = -1;
  let response = await fetch(base + "/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invalid),
  });
  assert.equal(response.status, 400);
  response = await fetch(base + "/api/checkout", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fixture()),
  });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});
test("unconfigured gateway returns explicit unavailable status without fake success", async (t) => {
  const base = await serve(t, { env: {} });
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.configured, false);
  const response = await fetch(base + "/api/checkout", {
    method: "POST",
    body: JSON.stringify(fixture()),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not available/);
});
test("receipt checks provider status and signed amount, ignoring return query claims", async (t) => {
  const order = validateCheckout(fixture(), now);
  const reference = signReference(order, secret, now);
  let status = "pending";
  const base = await serve(t, {
    fetchImpl: async () =>
      mockResponse({
        order_id: order.orderId,
        gross_amount: "700000.00",
        transaction_status: status,
      }),
  });
  let data = await (
    await fetch(
      base + "/api/orders/status?reference=" + reference + "&status=paid",
    )
  ).json();
  assert.equal(data.status, "pending");
  status = "settlement";
  data = await (
    await fetch(base + "/api/orders/status?reference=" + reference)
  ).json();
  assert.equal(data.status, "paid");
  const response = await fetch(
    base + "/api/orders/status?reference=" + reference + "bad",
  );
  assert.equal(response.status, 400);
});
test("gateway errors, duplicate checkout, and unsafe redirect URLs never return success", async (t) => {
  for (const upstream of [
    new Response("{}", { status: 500 }),
    new Response("{}", { status: 406 }),
    mockResponse({ redirect_url: "https://untrusted.example/checkout" }),
  ]) {
    const base = await serve(t, { fetchImpl: async () => upstream });
    const response = await fetch(base + "/api/checkout", {
      method: "POST",
      body: JSON.stringify(fixture()),
    });
    assert([409, 502].includes(response.status));
    assert.equal((await response.json()).paymentUrl, undefined);
  }
});
test("production mode selects production Midtrans endpoints", async (t) => {
  let target;
  const base = await serve(t, {
    env: { ...env, MIDTRANS_IS_PRODUCTION: "true" },
    fetchImpl: async (url) => {
      target = url;
      return mockResponse({
        redirect_url: "https://app.midtrans.com/snap/v4/redirection/test",
      });
    },
  });
  const response = await fetch(base + "/api/checkout", {
    method: "POST",
    body: JSON.stringify(fixture()),
  });
  assert.equal(response.status, 201);
  assert.equal(target, "https://app.midtrans.com/snap/v1/transactions");
});
