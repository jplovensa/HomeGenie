import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

export const catalog = JSON.parse(
  await readFile(new URL("../assets/catalog.json", import.meta.url), "utf8"),
);
export class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const cities = ["Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi"];
function text(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CheckoutError(`Please enter a valid ${name}.`);
  return value.trim();
}
export function validateCheckout(input, now = Date.now()) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 6
  )
    throw new CheckoutError("Your cart is empty or invalid.");
  if (
    typeof input.checkoutId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.checkoutId,
    )
  )
    throw new CheckoutError("Please refresh checkout and try again.");
  const seen = new Set();
  const items = input.items.map((item) => {
    const p = catalog.find((p) => p.id === item?.id);
    if (
      !p ||
      seen.has(p.id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 5
    )
      throw new CheckoutError("A service or quantity in your cart is invalid.");
    seen.add(p.id);
    // Never accept names, quantities-as-strings, discounts, or prices from the browser.
    return {
      id: p.id,
      price: p.price,
      quantity: item.quantity,
      name: p.eyebrow,
    };
  });
  const customer = input.customer || {};
  const name = text(customer.name, "full name", 100);
  const email = text(customer.email, "email address", 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new CheckoutError("Please enter a valid email address.");
  const phone = text(customer.phone, "phone number", 30);
  if (!/^[+0-9 ()-]{8,30}$/.test(phone))
    throw new CheckoutError("Please enter a valid phone number.");
  if (!cities.includes(customer.city))
    throw new CheckoutError("Please choose a supported project city.");
  const address = text(customer.address, "project address", 200);
  const date = text(customer.date, "preferred date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date ||
    date <=
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(now)) ||
    Date.parse(date) > now + 366 * 86400000
  )
    throw new CheckoutError(
      "Choose a preferred date from tomorrow through the next year.",
    );
  const notes = typeof customer.notes === "string" ? customer.notes.trim() : "";
  if (notes.length > 255)
    throw new CheckoutError("Project notes must be 255 characters or fewer.");
  if (customer.terms !== "on" && customer.terms !== true)
    throw new CheckoutError("Please review and accept the service terms.");
  return {
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    orderId: "HG-" + input.checkoutId.replaceAll("-", ""),
    customer: { name, email, phone, address, city: customer.city, date, notes },
  };
}
export function signReference(order, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      orderId: order.orderId,
      total: order.total,
      expires: now + 30 * 86400000,
    }),
  ).toString("base64url");
  return (
    payload + "." + createHmac("sha256", secret).update(payload).digest("hex")
  );
}
export function verifyReference(reference, secret, now = Date.now()) {
  if (typeof reference !== "string" || reference.length > 1000)
    throw new CheckoutError("This order reference is invalid.", 400);
  const [payload, signature, extra] = reference.split(".");
  const expected = createHmac("sha256", secret)
    .update(payload || "")
    .digest("hex");
  if (
    extra ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new CheckoutError("This order reference is invalid.", 400);
  let order;
  try {
    order = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new CheckoutError("This order reference is invalid.", 400);
  }
  if (
    !/^HG-[a-f0-9]{32}$/i.test(order.orderId || "") ||
    !Number.isSafeInteger(order.total) ||
    order.total <= 0 ||
    !Number.isFinite(order.expires) ||
    order.expires < now
  )
    throw new CheckoutError("This order reference is invalid or expired.", 400);
  return order;
}
export function paymentStatus(transaction, order) {
  if (
    transaction.order_id !== order.orderId ||
    Number(transaction.gross_amount) !== order.total ||
    (transaction.currency && transaction.currency !== "IDR")
  )
    throw new CheckoutError(
      "The payment details do not match this order. Please retain your Midtrans receipt.",
      502,
    );
  const status = transaction.transaction_status;
  if (
    status === "settlement" ||
    (status === "capture" && transaction.fraud_status === "accept")
  )
    return "paid";
  if (status === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(status)) return "failed";
  if (["refund", "partial_refund"].includes(status)) return "refunded";
  return "review";
}
export function createCommerceHandler({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const production = env.MIDTRANS_IS_PRODUCTION === "true";
  const snapBase = production
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const statusBase = production
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  const configured = Boolean(
    env.MIDTRANS_SERVER_KEY &&
    env.ORDER_SIGNING_SECRET &&
    env.ORDER_SIGNING_SECRET.length >= 32,
  );
  const site = new URL(
    env.SITE_URL || "https://jplovensa.github.io/HomeGenie/",
  );
  const allowedOrigins = new Set([
    site.origin,
    ...String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  const attempts = new Map();
  const headers = () => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization:
      "Basic " + Buffer.from(env.MIDTRANS_SERVER_KEY + ":").toString("base64"),
  });
  return async function commerce(req, res, pathname, url) {
    if (!pathname.startsWith("/api/")) return false;
    const origin = req.headers.origin;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Origin");
    const send = (code, data) => {
      res.writeHead(code);
      res.end(JSON.stringify(data));
    };
    const sameOrigin =
      origin &&
      (() => {
        try {
          return new URL(origin).host === req.headers.host;
        } catch {
          return false;
        }
      })();
    if (origin && !allowedOrigins.has(origin) && !sameOrigin) {
      send(403, {
        error: "This storefront is not authorized to use this payment service.",
      });
      return true;
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return true;
    }
    if (pathname === "/api/health" && req.method === "GET") {
      send(200, {
        provider: "midtrans",
        configured,
        mode: production ? "production" : "sandbox",
      });
      return true;
    }
    if (!["/api/checkout", "/api/orders/status"].includes(pathname)) {
      send(404, { error: "Not found." });
      return true;
    }
    if (!configured) {
      send(503, {
        error:
          "Online payments are not available yet. Your cart is saved. Please try again later.",
      });
      return true;
    }
    try {
      if (pathname === "/api/checkout" && req.method === "POST") {
        const ip = req.socket.remoteAddress || "unknown";
        const timestamp = now();
        for (const [key, value] of attempts)
          if (timestamp - value.start > 60000) attempts.delete(key);
        const attempt = attempts.get(ip) || { start: timestamp, count: 0 };
        attempt.count++;
        attempts.set(ip, attempt);
        if (attempt.count > 60)
          throw new CheckoutError(
            "Too many checkout attempts. Please try again in a minute.",
            429,
          );
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 16384)
            throw new CheckoutError("The checkout request is too large.", 413);
          chunks.push(chunk);
        }
        let input;
        try {
          input = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          throw new CheckoutError("Please submit valid checkout details.");
        }
        const order = validateCheckout(input, now());
        const reference = signReference(order, env.ORDER_SIGNING_SECRET, now());
        const returnUrl = new URL(site);
        returnUrl.search = "";
        returnUrl.hash = "";
        returnUrl.searchParams.set("order", reference);
        const [firstName, ...rest] = order.customer.name.split(" ");
        const address = {
          first_name: firstName,
          last_name: rest.join(" "),
          email: order.customer.email,
          phone: order.customer.phone,
          address: order.customer.address,
          city: order.customer.city,
          country_code: "IDN",
        };
        const payload = {
          transaction_details: {
            order_id: order.orderId,
            gross_amount: order.total,
          },
          item_details: order.items,
          customer_details: {
            first_name: firstName,
            last_name: rest.join(" "),
            email: order.customer.email,
            phone: order.customer.phone,
            billing_address: address,
            shipping_address: address,
          },
          callbacks: { finish: returnUrl.href },
          custom_field1: "Preferred date: " + order.customer.date,
          custom_field2: "Project city: " + order.customer.city,
          custom_field3: order.customer.notes,
          expiry: { unit: "hours", duration: 24 },
        };
        const response = await fetchImpl(snapBase + "/snap/v1/transactions", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        const payment = await response.json();
        if (!response.ok) {
          if (response.status === 406)
            throw new CheckoutError(
              "A payment was already started for this cart. Check your saved Midtrans checkout or payment receipt before trying again.",
              409,
            );
          throw new CheckoutError(
            "Secure checkout is temporarily unavailable. No payment has been assumed. Please try again later.",
            502,
          );
        }
        let paymentUrl;
        try {
          paymentUrl = new URL(payment.redirect_url);
        } catch {
          throw new CheckoutError(
            "The payment provider did not return a valid checkout link.",
            502,
          );
        }
        if (paymentUrl.origin !== snapBase)
          throw new CheckoutError(
            "The payment provider returned an unexpected checkout destination.",
            502,
          );
        send(201, {
          paymentUrl: paymentUrl.href,
          reference,
          orderId: order.orderId,
          total: order.total,
          mode: production ? "production" : "sandbox",
        });
        return true;
      }
      if (pathname === "/api/orders/status" && req.method === "GET") {
        const order = verifyReference(
          url.searchParams.get("reference"),
          env.ORDER_SIGNING_SECRET,
          now(),
        );
        const response = await fetchImpl(
          statusBase + "/v2/" + encodeURIComponent(order.orderId) + "/status",
          { headers: headers(), signal: AbortSignal.timeout(15000) },
        );
        const transaction = await response.json();
        if (response.status === 404 || transaction.status_code === "404") {
          send(200, {
            orderId: order.orderId,
            total: order.total,
            status: "pending",
          });
          return true;
        }
        if (!response.ok)
          throw new CheckoutError(
            "Payment status is temporarily unavailable. Keep your Midtrans receipt and try again.",
            502,
          );
        send(200, {
          orderId: order.orderId,
          total: order.total,
          status: paymentStatus(transaction, order),
        });
        return true;
      }
      send(405, { error: "Method not allowed." });
      return true;
    } catch (error) {
      send(error instanceof CheckoutError ? error.status : 502, {
        error:
          error instanceof CheckoutError
            ? error.message
            : "We couldn’t reach the payment provider. Keep any payment receipt and try again later.",
      });
      return true;
    }
  };
}
