"use strict";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const icons = JSON.parse($("#icon-data").textContent);
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const money = (amount) => "Rp " + new Intl.NumberFormat("id-ID").format(amount);
const readStorage = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can disable persistence. */
  }
};
const initialCart = readStorage("homegenie-cart", []);
const initialSaved = readStorage("homegenie-saved", []);
const state = {
  products: [],
  cart: Array.isArray(initialCart) ? initialCart : [],
  saved: Array.isArray(initialSaved) ? initialSaved : [],
  category: "All services",
  search: "",
  sort: "featured",
  onlySaved: false,
  location: readStorage("homegenie-location", "Jabodetabek"),
  room: "Living room",
  goal: "A fresh perspective",
  budget: "Under Rp 1 million",
  checkout: {},
  checkoutId: null,
  submitting: false,
  returnFocus: null,
};
const overlay = $("#overlay");
const panel = $("#panel");
let toastTimer;
const config = window.HOMEGENIE_CONFIG || {};
const apiBase = config.commerceApiUrl
  ? config.commerceApiUrl.replace(/\/$/, "")
  : ["localhost", "127.0.0.1"].includes(location.hostname)
    ? new URL("./api", location.href).href
    : "";
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}
function product(id) {
  return state.products.find((item) => item.id === id);
}
function cartItems() {
  return state.cart
    .map((item) => ({ ...product(item.id), quantity: item.quantity }))
    .filter((item) => item.id);
}
function cartTotal() {
  return cartItems().reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
}
function saveCart() {
  state.checkoutId = null;
  writeStorage("homegenie-cart", state.cart);
  updateBadges();
}
function updateBadges() {
  const count = state.cart.reduce((total, item) => total + item.quantity, 0);
  $$(".cart-count").forEach((el) => {
    el.textContent = count;
  });
  $("[data-cart]").setAttribute(
    "aria-label",
    `Open shopping cart (${count} ${count === 1 ? "item" : "items"})`,
  );
  const savedCount = $(".saved-count");
  savedCount.textContent = state.saved.length;
  savedCount.hidden = !state.saved.length;
  $$("[data-save]").forEach((button) => {
    const saved = state.saved.includes(button.dataset.save);
    button.classList.toggle("saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute(
      "aria-label",
      `${saved ? "Unsave" : "Save"} ${product(button.dataset.save)?.name || "service"}`,
    );
  });
}
function filterProducts() {
  const cards = $$(".product-card");
  cards.sort((a, b) =>
    state.sort === "price-low"
      ? Number(a.dataset.price) - Number(b.dataset.price)
      : state.sort === "price-high"
        ? Number(b.dataset.price) - Number(a.dataset.price)
        : state.products.findIndex((p) => p.id === a.dataset.product) -
          state.products.findIndex((p) => p.id === b.dataset.product),
  );
  cards.forEach((card) => {
    $(".product-grid").append(card);
    const p = product(card.dataset.product);
    const match =
      (state.category === "All services" || p.category === state.category) &&
      (!state.onlySaved || state.saved.includes(p.id)) &&
      `${p.name} ${p.category} ${p.eyebrow} ${p.description}`
        .toLowerCase()
        .includes(state.search.toLowerCase());
    card.hidden = !match;
  });
  const count = cards.filter((card) => !card.hidden).length;
  $("#results-count").textContent = state.onlySaved
    ? `${count} saved ${count === 1 ? "service" : "services"}`
    : state.search || state.category !== "All services"
      ? `${count} ${count === 1 ? "service" : "services"} for your space`
      : "6 considered services. One happier home.";
  $$(".category-tabs button").forEach((button) => {
    const active = button.dataset.categoryFilter === state.category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $(".no-results").hidden = count > 0;
  $(".clear-filters").hidden = !(
    state.search ||
    state.category !== "All services" ||
    state.onlySaved
  );
}
function resetFilters() {
  state.category = "All services";
  state.search = "";
  state.onlySaved = false;
  $("#search").value = "";
  filterProducts();
}
function closePanel() {
  overlay.hidden = true;
  document.body.style.overflow = "";
  state.returnFocus?.focus();
}
function showPanel(title, content, drawer = false, preserveFocus = false) {
  if (overlay.hidden) state.returnFocus = document.activeElement;
  panel.className = "panel" + (drawer ? " drawer" : "");
  panel.innerHTML = `<div class="panel-heading"><h2 id="panel-title">${escapeHTML(title)}</h2><button class="icon-button" data-close aria-label="Close dialog">${icon("close")}</button></div>${content}`;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  if (!preserveFocus) $("[data-close]", panel).focus();
}
function addToCart(id, open = false) {
  const p = product(id);
  if (!p) return;
  const existing = state.cart.find((item) => item.id === id);
  if (existing?.quantity >= 5) {
    toast(
      "Up to 5 packages per service. Contact the team for larger projects.",
    );
    return;
  }
  if (existing) existing.quantity++;
  else state.cart.push({ id, quantity: 1 });
  saveCart();
  toast(`${p.eyebrow} added to your cart`);
  if (open) renderCart();
}
function renderDetail(id) {
  const p = product(id);
  if (!p) return;
  showPanel(
    p.eyebrow,
    `<img class="detail-image" src="./assets/images/${escapeHTML(p.image)}" alt="${escapeHTML(p.name)} inspiration"><div class="eyebrow">${escapeHTML(p.delivery)}</div><h2>${escapeHTML(p.name)}</h2><p class="panel-intro">${escapeHTML(p.description)}</p><span class="detail-price">${money(p.price)}</span><span class="detail-unit">${escapeHTML(p.unit)}</span><h3 class="detail-subheading">A little clarity. Here’s what’s included.</h3><ul class="scope-list">${p.includes.map((item) => `<li>${icon("check")}<span>${escapeHTML(item)}</span></li>`).join("")}</ul><div class="detail-time">${icon("clock")} ${escapeHTML(p.timeline)}</div><button class="button dark full" data-detail-add="${p.id}">Add to cart · ${money(p.price)} ${icon("bag")}</button><p class="secure-note">${icon("shield")} Scope and deliverables included. Physical products and construction excluded.</p>`,
  );
}
function renderCart() {
  const items = cartItems();
  if (!items.length) {
    showPanel(
      "Your little home plan",
      `<div class="cart-empty">${icon("bag")}<h3>A little room for possibility.</h3><p>Your cart is waiting for its first good idea.<br>Find the service that feels right for your space.</p><button class="button dark" data-shop>Explore services ${icon("arrow")}</button></div>`,
      true,
    );
    return;
  }
  showPanel(
    `Your cart (${items.reduce((s, i) => s + i.quantity, 0)})`,
    `<p class="panel-intro">Good things are taking shape.</p><div class="cart-items">${items.map((p) => `<article class="cart-item"><img src="./assets/images/${p.image}" alt="${escapeHTML(p.eyebrow)}"><div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.unit)}</p><strong>${money(p.price)}</strong><div class="cart-item-bottom"><div class="quantity-control" aria-label="Quantity for ${escapeHTML(p.name)}"><button data-quantity="${p.id}" data-delta="-1" aria-label="Decrease quantity of ${escapeHTML(p.name)}">${icon("minus")}</button><span aria-live="polite">${p.quantity}</span><button data-quantity="${p.id}" data-delta="1" aria-label="Increase quantity of ${escapeHTML(p.name)}" ${p.quantity >= 5 ? "disabled" : ""}>${icon("plus")}</button></div><button class="remove-item" data-remove="${p.id}">Remove</button></div></div></article>`).join("")}</div><div class="cart-summary"><div class="summary-line"><span>Service packages</span><span>${money(cartTotal())}</span></div><div class="summary-line"><span>Delivery</span><span>Included in package</span></div><div class="summary-line total"><span>Total</span><strong>${money(cartTotal())}</strong></div><p class="summary-note">No materials or construction charges included. Each quantity represents a separate service package.</p><button class="button dark full" data-checkout>Continue to checkout ${icon("arrow")}</button><p class="secure-note">${icon("lock")} Secure payment with Midtrans</p><button class="continue-shopping" data-shop>Keep exploring</button></div>`,
    true,
  );
}
function field(name, label, type = "text", placeholder = "", extra = "") {
  const value = state.checkout[name] || "";
  return `<div class="field ${extra}"><label for="checkout-${name}">${label}</label><input id="checkout-${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" required ${name === "name" ? 'autocomplete="name" maxlength="100"' : name === "email" ? 'autocomplete="email" maxlength="200"' : name === "phone" ? 'autocomplete="tel" maxlength="30" pattern="[+0-9 ()-]{8,30}"' : name === "date" ? `min="${new Date(Date.now() + 86400000).toLocaleDateString("en-CA")}"` : ""}></div>`;
}
function renderCheckout() {
  if (!state.cart.length) return renderCart();
  const cities = ["Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi"];
  showPanel(
    "Make it yours.",
    `<p class="panel-intro">A few details, then a little closer to home.</p><form id="checkout-form"><h3 class="checkout-subtitle">Your details</h3><div class="checkout-grid">${field("name", "Full name", "text", "Your full name", "full")}${field("email", "Email address", "email", "you@example.com")}${field("phone", "WhatsApp / phone", "tel", "+62 812 3456 7890")}</div><h3 class="checkout-subtitle">About your project</h3><div class="checkout-grid"><div class="field"><label for="checkout-city">Project location</label><select id="checkout-city" name="city" required>${cities.map((city) => `<option ${state.checkout.city === city || (!state.checkout.city && state.location === city) ? "selected" : ""}>${city}</option>`).join("")}</select></div>${field("date", "Preferred date", "date")}<div class="field full"><label for="checkout-address">Project address</label><textarea id="checkout-address" name="address" maxlength="200" required placeholder="Street address, area, and postal code">${escapeHTML(state.checkout.address || "")}</textarea></div><div class="field full"><label for="checkout-notes">Anything you’d like us to know? <span>(optional)</span></label><textarea id="checkout-notes" name="notes" maxlength="255" placeholder="Your space, ideas, or questions…">${escapeHTML(state.checkout.notes || "")}</textarea></div></div><p class="payment-disclosure">Your preferred date is a request. The team confirms the schedule after payment. For online services, we’ll use your email to coordinate.</p><div class="checkout-summary">${cartItems()
      .map(
        (p) =>
          `<div class="summary-line"><span>${escapeHTML(p.eyebrow)} × ${p.quantity}</span><span>${money(p.price * p.quantity)}</span></div>`,
      )
      .join(
        "",
      )}<div class="summary-line total"><span>Total</span><strong>${money(cartTotal())}</strong></div></div><label class="terms-check"><input type="checkbox" name="terms" required><span>I have reviewed the package scope and understand that scheduling is confirmed after payment. I agree to the <button type="button" class="inline-link" data-checkout-policy>service and cancellation terms</button>.</span></label><div id="checkout-error" class="form-error" role="alert" hidden></div>${!apiBase ? '<p class="form-error">Online payments are not available yet. Your cart is saved so you can come back when checkout opens.</p>' : ""}<button class="button dark full" type="submit" ${!apiBase ? "disabled" : ""}>Continue to Midtrans ${icon("lock")}</button><p class="secure-note">${icon("shield")} Cards, bank transfers, and e-wallets supported by your Midtrans checkout.</p><button class="continue-shopping" type="button" data-cart>Back to cart</button></form>`,
  );
}
async function submitCheckout(form) {
  if (state.submitting || !form.reportValidity()) return;
  state.checkout = Object.fromEntries(new FormData(form));
  const errorBox = $("#checkout-error");
  if (!apiBase) {
    errorBox.hidden = false;
    errorBox.textContent =
      "Online payments are not available yet. Your cart has been saved.";
    return;
  }
  state.submitting = true;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  submit.textContent = "Preparing your secure checkout…";
  errorBox.hidden = true;
  try {
    if (!state.checkoutId) state.checkoutId = crypto.randomUUID();
    const response = await fetch(apiBase + "/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutId: state.checkoutId,
        items: state.cart.map(({ id, quantity }) => ({ id, quantity })),
        customer: state.checkout,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "We couldn’t prepare checkout. Please try again.",
      );
    const url = new URL(data.paymentUrl);
    if (
      url.protocol !== "https:" ||
      !["app.midtrans.com", "app.sandbox.midtrans.com"].includes(url.hostname)
    )
      throw new Error(
        "The payment link could not be verified. Please try again.",
      );
    writeStorage("homegenie-order", {
      reference: data.reference,
      paymentUrl: data.paymentUrl,
      items: state.cart,
      total: data.total,
    });
    location.assign(url.href);
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent =
      error.name === "TimeoutError"
        ? "Checkout is taking longer than expected. Your cart is safe. Please try again."
        : error.message === "Failed to fetch"
          ? "We couldn’t reach secure checkout. Your cart is saved. Please try again shortly."
          : error.message;
    submit.disabled = false;
    submit.innerHTML = `Continue to Midtrans ${icon("lock")}`;
  } finally {
    state.submitting = false;
  }
}
function renderGenie(result = false) {
  if (result) {
    const choices =
      state.room === "Kitchen"
        ? ["kitchen-layout", "design-consultation"]
        : state.room === "Whole home" || state.goal === "Plan a renovation"
          ? ["renovation-visit", "design-consultation"]
          : state.goal === "Colours & finishing touches"
            ? ["colour-consultation", "finishing-touches"]
            : state.budget === "Under Rp 1 million"
              ? ["design-consultation", "colour-consultation"]
              : ["room-styling", "finishing-touches"];
    showPanel(
      "A little direction, just for you.",
      `<div class="eyebrow">${escapeHTML(state.room)} · ${escapeHTML(state.budget)}</div><p class="panel-intro">Based on your wish for “${escapeHTML(state.goal.toLowerCase())}”, these are good places to start.</p>${choices
        .map((id) => {
          const p = product(id);
          return `<div class="genie-result-box"><div class="eyebrow">${escapeHTML(p.eyebrow)}</div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description)}</p><button class="button dark" data-detail="${p.id}">Explore package · ${money(p.price)} ${icon("up")}</button></div>`;
        })
        .join(
          "",
        )}<p class="secure-note">Guided suggestions based on your choices. No AI-generated quotations.</p><button class="continue-shopping" data-genie>Refine my wish</button>`,
    );
    return;
  }
  showPanel(
    "Hello, home dreamer.",
    `<div class="genie-heading-icon">${icon("spark")}</div><div class="eyebrow">YOUR PERSONAL HOME GENIE</div><h2>What’s your space wishing for?</h2><p class="panel-intro">Tell me a little. I’ll help you find a good first step.</p><div class="field-group-title">Which space are we thinking about?</div><div class="choice-grid">${["Living room", "Kitchen", "Bedroom", "Whole home"].map((room) => `<button data-room="${room}" class="${state.room === room ? "selected" : ""}" aria-pressed="${state.room === room}">${room}</button>`).join("")}</div><div class="field"><label for="genie-goal">What would you like to do?</label><select id="genie-goal">${["A fresh perspective", "Style my space", "Plan a renovation", "Colours & finishing touches"].map((goal) => `<option ${state.goal === goal ? "selected" : ""}>${goal}</option>`).join("")}</select></div><div class="field"><label for="genie-budget">Your service budget</label><select id="genie-budget">${["Under Rp 1 million", "Rp 1–3 million", "Help me figure it out"].map((budget) => `<option ${state.budget === budget ? "selected" : ""}>${budget}</option>`).join("")}</select></div><button class="button dark full" data-genie-result>Find my starting point ${icon("spark")}</button>`,
  );
}
const policies = {
  service: {
    title: "Service & scheduling",
    body: "Each package includes only the deliverables listed in its service details. Furniture, materials, installation, and construction are excluded unless explicitly stated. Quantities represent separate service packages. Online consultations are coordinated by email. Site assessments cover Jabodetabek only. Your requested date is subject to availability and is confirmed by the team after payment. If the requested date is unavailable, the team will agree on an alternative with you before starting work.",
  },
  refund: {
    title: "Cancellations & refunds",
    body: "Before paying, review the package scope carefully. You may request cancellation before the service begins. Refund eligibility depends on work already completed and any nonrecoverable payment costs; the team will confirm the amount before processing. If the team cannot provide your purchased service and you do not accept an alternative, a refund will be arranged. Once a digital design deliverable has been completed and supplied, it is not automatically refundable. Your consumer rights remain unaffected. Keep your Midtrans payment receipt and use the contact details on your order confirmation for assistance.",
  },
  privacy: {
    title: "Your privacy",
    body: "Your cart and favorites are stored in your own browser when storage is available. At checkout, your name, email, phone, project address, preferred date, and project notes are sent to the payment API and Midtrans to create and coordinate your service order. HomeGenie does not collect card numbers on this website. Card and payment information is handled on Midtrans’s hosted checkout. Avoid including sensitive personal information in project notes. Order status is retrieved using a signed reference. Clear your browser storage to remove locally saved shopping data.",
  },
};
async function showReceipt(reference) {
  showPanel(
    "Your HomeGenie order",
    `<p class="panel-intro">Checking your payment securely with Midtrans…</p>`,
  );
  if (!apiBase) {
    showPanel(
      "Your HomeGenie order",
      `<div class="form-error">We can’t check payment status right now. Keep your Midtrans receipt and return to this page later. Your payment status has not been assumed.</div>`,
    );
    return;
  }
  try {
    const response = await fetch(
      apiBase + "/orders/status?reference=" + encodeURIComponent(reference),
      { signal: AbortSignal.timeout(15000) },
    );
    const order = await response.json();
    if (!response.ok)
      throw new Error(order.error || "Unable to check order status.");
    const paid = order.status === "paid";
    if (paid) {
      const storedOrder = readStorage("homegenie-order", null);
      if (storedOrder?.reference === reference && !storedOrder.cartCleared) {
        // A receipt for an older order must not erase a newer shopping cart.
        if (JSON.stringify(storedOrder.items) === JSON.stringify(state.cart)) {
          state.cart = [];
          saveCart();
        }
        writeStorage("homegenie-order", { ...storedOrder, cartCleared: true });
      }
    }
    showPanel(
      paid ? "A good beginning." : "Your HomeGenie order",
      `<div class="receipt-icon">${paid ? "✳" : icon("clock")}</div><div class="eyebrow">ORDER ${escapeHTML(order.orderId)}</div><div class="receipt-status"><strong>${paid ? "Payment confirmed." : order.status === "pending" ? "Your payment is pending." : order.status === "failed" ? "Payment was not completed." : order.status === "refunded" ? "Your payment has been refunded." : "Your order is being reviewed."}</strong><p>${paid ? "Your payment has been verified with Midtrans. Keep your payment receipt. The team will coordinate your project brief and confirm your schedule." : "Your cart is saved. A return from checkout does not mean payment is complete. You can check your status again below."}</p></div><div class="summary-line total"><span>Order total</span><strong>${money(order.total)}</strong></div>${!paid ? `<button class="button dark full" data-refresh-order="${escapeHTML(reference)}">Check payment status ${icon("arrow")}</button>` : ""}<button class="continue-shopping" data-shop>Back to HomeGenie</button>`,
    );
  } catch (error) {
    showPanel(
      "Your HomeGenie order",
      `<div class="form-error">${escapeHTML(error.message)} Keep your Midtrans receipt. We haven’t marked this order paid.</div><button class="button dark full" data-refresh-order="${escapeHTML(reference)}">Try again ${icon("arrow")}</button>`,
    );
  }
}
async function init() {
  try {
    const response = await fetch(
      new URL("./assets/catalog.json", document.baseURI),
    );
    if (!response.ok) throw new Error("Catalog unavailable");
    state.products = await response.json();
    state.cart = state.cart.filter(
      (i) =>
        i &&
        typeof i === "object" &&
        product(i.id) &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 5,
    );
    state.saved = state.saved.filter((id) => product(id));
    updateBadges();
    if (typeof state.location !== "string") state.location = "Jabodetabek";
    $("#location-label").textContent = state.location;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button,a[data-action]");
      if (!button) return;
      if (button.hasAttribute("data-close")) closePanel();
      else if (button.dataset.add) addToCart(button.dataset.add);
      else if (button.dataset.detailAdd)
        addToCart(button.dataset.detailAdd, true);
      else if (button.dataset.detail) renderDetail(button.dataset.detail);
      else if (button.hasAttribute("data-cart")) renderCart();
      else if (button.hasAttribute("data-checkout")) renderCheckout();
      else if (button.hasAttribute("data-shop")) {
        closePanel();
        $("#shop").scrollIntoView({ behavior: "smooth" });
      } else if (button.dataset.save) {
        const id = button.dataset.save;
        state.saved = state.saved.includes(id)
          ? state.saved.filter((item) => item !== id)
          : [...state.saved, id];
        writeStorage("homegenie-saved", state.saved);
        updateBadges();
        if (state.onlySaved) filterProducts();
        toast(
          state.saved.includes(id)
            ? "Saved for a little inspiration later."
            : "Removed from saved services.",
        );
      } else if (button.dataset.quantity) {
        const item = state.cart.find((i) => i.id === button.dataset.quantity);
        if (item) {
          item.quantity += Number(button.dataset.delta);
          state.cart = state.cart.filter((i) => i.quantity > 0);
          saveCart();
          renderCart();
        }
      } else if (button.dataset.remove) {
        state.cart = state.cart.filter((i) => i.id !== button.dataset.remove);
        saveCart();
        renderCart();
      } else if (button.dataset.categoryFilter) {
        state.category = button.dataset.categoryFilter;
        state.onlySaved = false;
        filterProducts();
      } else if (
        button.hasAttribute("data-reset") ||
        button.classList.contains("clear-filters")
      )
        resetFilters();
      else if (button.hasAttribute("data-show-saved")) {
        state.onlySaved = !state.onlySaved;
        state.category = "All services";
        state.search = "";
        $("#search").value = "";
        filterProducts();
        $("#shop").scrollIntoView({ behavior: "smooth" });
      } else if (button.hasAttribute("data-genie")) renderGenie();
      else if (button.dataset.room) {
        state.room = button.dataset.room;
        $$("[data-room]", panel).forEach((b) => {
          const selected = b.dataset.room === state.room;
          b.classList.toggle("selected", selected);
          b.setAttribute("aria-pressed", String(selected));
        });
      } else if (button.hasAttribute("data-genie-result")) {
        state.goal = $("#genie-goal").value;
        state.budget = $("#genie-budget").value;
        renderGenie(true);
      } else if (button.hasAttribute("data-location"))
        showPanel(
          "A little closer to home.",
          `<p class="panel-intro">Where is your project? Our in-person services cover Jabodetabek. Digital services are available wherever you call home.</p><div class="location-choices">${["Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi", "Jabodetabek"].map((city) => `<button data-city="${city}">${city}</button>`).join("")}</div>`,
        );
      else if (button.dataset.city) {
        state.location = button.dataset.city;
        writeStorage("homegenie-location", state.location);
        $("#location-label").textContent = state.location;
        closePanel();
      } else if (button.dataset.policy) {
        const policy = policies[button.dataset.policy];
        if (policy)
          showPanel(
            policy.title,
            `<p class="policy-text">${escapeHTML(policy.body)}</p>`,
          );
      } else if (button.hasAttribute("data-checkout-policy")) {
        state.checkout = Object.fromEntries(new FormData($("#checkout-form")));
        showPanel(
          "Before we begin.",
          `<h3 class="checkout-subtitle">Service & scheduling</h3><p class="policy-text">${escapeHTML(policies.service.body)}</p><h3 class="checkout-subtitle">Cancellations & refunds</h3><p class="policy-text">${escapeHTML(policies.refund.body)}</p><button class="button dark full" data-checkout>Back to checkout ${icon("arrow")}</button>`,
        );
      } else if (button.dataset.refreshOrder)
        showReceipt(button.dataset.refreshOrder);
    });
    $("#search").addEventListener("input", (event) => {
      state.search = event.target.value;
      filterProducts();
    });
    $("#sort").addEventListener("change", (event) => {
      state.sort = event.target.value;
      filterProducts();
    });
    document.addEventListener("submit", (event) => {
      if (event.target.id === "checkout-form") {
        event.preventDefault();
        submitCheckout(event.target);
      }
    });
    $(".mobile-toggle").addEventListener("click", () => {
      const open = $("#main-nav").classList.toggle("open");
      $(".mobile-toggle").setAttribute("aria-expanded", String(open));
    });
    $$("#main-nav a").forEach((a) =>
      a.addEventListener("click", () => {
        $("#main-nav").classList.remove("open");
        $(".mobile-toggle").setAttribute("aria-expanded", "false");
      }),
    );
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && !state.submitting) closePanel();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !state.submitting) {
        if (!overlay.hidden) closePanel();
        $("#main-nav").classList.remove("open");
        $(".mobile-toggle").setAttribute("aria-expanded", "false");
      }
      if (event.key === "Tab" && !overlay.hidden) {
        const controls = $$(
          "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
          panel,
        ).filter((e) => !e.hidden);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    const reference = new URLSearchParams(location.search).get("order");
    if (reference) showReceipt(reference);
  } catch (error) {
    toast(
      "Shopping tools are temporarily unavailable. Please refresh to try again.",
    );
    console.error("HomeGenie catalog initialization failed:", error.message);
  }
}
init();
