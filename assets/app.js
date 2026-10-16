"use strict";

// The full page is HTML. This script only enhances its optional controls.
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const overlay = $("#genie-overlay");
const dialog = $(".genie-modal", overlay);
const state = {
  room: "Living room",
  budget: "Rp 5–15 million",
  location: "Jakarta",
  saved: [],
  returnFocus: null,
};
try {
  const saved = JSON.parse(localStorage.getItem("homegenia-favorites") || "[]");
  if (Array.isArray(saved)) state.saved = saved;
} catch {
  /* Storage is optional. */
}

function updateFavorites() {
  $$("[data-favorite]").forEach((button) => {
    const saved = state.saved.includes(button.dataset.favorite);
    button.classList.toggle("saved", saved);
    button.setAttribute(
      "aria-label",
      saved ? "Unsave service" : "Save service",
    );
    button.setAttribute("aria-pressed", String(saved));
    $("svg", button).setAttribute("fill", saved ? "currentColor" : "none");
  });
}
function filterServices(category) {
  $$("[data-category].service-card").forEach((card) => {
    card.hidden =
      category !== "All services" && card.dataset.category !== category;
  });
  $$(".categories [data-category]").forEach((button) => {
    const active = button.dataset.category === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function closeGenie() {
  overlay.hidden = true;
  document.body.style.overflow = "";
  state.returnFocus?.focus();
}
function renderGenie(step) {
  dialog.replaceChildren($("#genie-" + step).content.cloneNode(true));
  $(".close-modal", dialog).addEventListener("click", closeGenie);
  if (step === "start") {
    $$(".room-options button", dialog).forEach((button) => {
      const selected = button.textContent.trim() === state.room;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      // Keep the selection mark aligned with the actual room.
      const check = $("svg", button);
      if (check) check.remove();
      button.addEventListener("click", () => {
        state.room = button.textContent.trim();
        renderGenie("start");
        $(".room-options .selected", dialog).focus();
      });
    });
    $("#budget", dialog).value = state.budget;
    $("#budget", dialog).addEventListener("change", (event) => {
      state.budget = event.target.value;
    });
    $(".button.full", dialog).addEventListener("click", () => {
      renderGenie("result");
      $("#genie-title").setAttribute("tabindex", "-1");
      $("#genie-title").focus();
    });
  } else {
    const summary = dialog.querySelector(":scope > p");
    summary.textContent = `Your wish: ${state.room} · ${state.budget} · ${state.location}`;
    $(".assistant-reply p", dialog).textContent =
      state.room === "Kitchen"
        ? "A kitchen makeover can make everyday cooking feel special. Start with our curated services, then plan the details with an expert."
        : state.room === "Bathroom"
          ? "Let’s turn your bathroom into a calming little retreat. Start with our curated services, then plan the details with an expert."
          : "Let’s bring warmth, personality, and a fresh perspective to your space. Start with our curated services, then plan the details with an expert.";
    const input = $(".chat-input input", dialog);
    const send = $(".chat-input button", dialog);
    input.addEventListener("input", () => {
      send.disabled = !input.value.trim();
    });
    $(".chat-input", dialog).addEventListener("submit", (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      const user = document.createElement("div");
      user.className = "user-message";
      user.textContent = message;
      const answer = document.createElement("div");
      answer.className = "chat-answer";
      answer.textContent = `Let’s plan your ${state.room.toLowerCase()} around a ${state.budget} budget. Start with a focused refresh and compare the service options below. An expert can help you confirm materials, scope, and a final quote.`;
      const chat = $(".chat-messages", dialog);
      chat.setAttribute("aria-live", "polite");
      chat.append(user, answer);
      input.value = "";
      send.disabled = true;
      chat.scrollTop = chat.scrollHeight;
    });
    $(".button.full", dialog).addEventListener("click", () => {
      filterServices(
        state.room === "Kitchen"
          ? "Kitchen makeover"
          : state.room === "Bathroom"
            ? "Bathroom refresh"
            : state.room === "Living room"
              ? "Interior styling"
              : "All services",
      );
      closeGenie();
      $("#services").scrollIntoView({ behavior: "smooth" });
    });
    $(".back-button", dialog).addEventListener("click", () =>
      renderGenie("start"),
    );
  }
}
function openGenie(service) {
  state.returnFocus = document.activeElement;
  if (service) {
    const category = service.dataset.category;
    state.room =
      category === "Kitchen makeover"
        ? "Kitchen"
        : category === "Bathroom refresh"
          ? "Bathroom"
          : "Living room";
  }
  renderGenie("start");
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  $(".close-modal", dialog).focus();
}
$$("[data-open-genie]").forEach((button) =>
  button.addEventListener("click", () => openGenie()),
);
$$("[data-service]").forEach((control) =>
  control.addEventListener("click", (event) => {
    if (event.target.closest("[data-favorite]")) return;
    openGenie(control.closest(".service-card"));
  }),
);
$$("[data-favorite]").forEach((button) =>
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const id = button.dataset.favorite;
    state.saved = state.saved.includes(id)
      ? state.saved.filter((item) => item !== id)
      : [...state.saved, id];
    try {
      localStorage.setItem("homegenia-favorites", JSON.stringify(state.saved));
    } catch {
      /* Session interaction still works without storage. */
    }
    updateFavorites();
  }),
);
$$(".categories [data-category]").forEach((button) =>
  button.addEventListener("click", () =>
    filterServices(button.dataset.category),
  ),
);
$("[data-all-services]").addEventListener("click", () =>
  filterServices("All services"),
);

const locationButton = $(".location");
const locationMenu = document.createElement("div");
locationMenu.className = "location-menu";
locationMenu.hidden = true;
["Jakarta", "Tangerang", "Bekasi", "Depok", "Bogor"].forEach((city) => {
  const button = document.createElement("button");
  button.textContent = city;
  button.addEventListener("click", () => {
    state.location = city;
    // Replace just the label, preserving the decorative icon and chevron.
    [...locationButton.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .forEach((node) => node.remove());
    locationButton.insertBefore(
      document.createTextNode(city),
      $("svg", locationButton),
    );
    locationMenu.hidden = true;
    locationButton.setAttribute("aria-expanded", "false");
    locationButton.focus();
  });
  locationMenu.append(button);
});
$(".location-wrap").append(locationMenu);
locationButton.addEventListener("click", () => {
  locationMenu.hidden = !locationMenu.hidden;
  locationButton.setAttribute("aria-expanded", String(!locationMenu.hidden));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".location-wrap")) {
    locationMenu.hidden = true;
    locationButton.setAttribute("aria-expanded", "false");
  }
});
const menuButton = $(".mobile-toggle");
menuButton.addEventListener("click", () => {
  const open = $("header nav").classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
$$("header nav a").forEach((link) =>
  link.addEventListener("click", () => {
    $("header nav").classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
  }),
);
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeGenie();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!overlay.hidden) closeGenie();
    locationMenu.hidden = true;
    locationButton.setAttribute("aria-expanded", "false");
    $("header nav").classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
  }
  if (event.key === "Tab" && !overlay.hidden) {
    const controls = $$(
      "button:not(:disabled), input, select, a[href]",
      dialog,
    );
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
updateFavorites();
filterServices("All services");
