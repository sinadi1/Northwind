/**
 * app.js - entry point. Wires the API client, state, filters and UI together.
 * Flow: show skeleton -> fetch (async/await) -> render -> react to input
 * (search / category / sort / cart) without ever reloading the page.
 */
import { fetchProducts, fetchCategories, ApiError } from "./api.js";
import { prefsStore, cartStore, cartActions, cartTotals } from "./state.js";
import { applyFilters, debounce, SORTS } from "./filters.js";
import {
  renderSkeleton, renderProducts, renderCategories, renderCart, showBanner, clearBanner,
} from "./ui.js";

const $ = (id) => document.getElementById(id);
const els = {
  banner: $("error-banner"),
  grid: $("product-grid"),
  tabs: $("category-tabs"),
  search: $("product-search"),
  sort: $("product-sort"),
  count: $("result-count"),
  cart: $("cart-body"),
  cartHeading: $("cart-heading"),
};

let products = [];
let categories = [];

/* ---- Rendering ----------------------------------------------------------- */
function renderResults() {
  const prefs = prefsStore.get();
  const visible = applyFilters(products, prefs);
  renderProducts(els.grid, visible, (p) => cartActions.add(p));
  els.count.textContent = `Showing ${visible.length} of ${products.length} products`;
  renderCategories(els.tabs, categories, prefs.category, (category) =>
    prefsStore.update((p) => ({ ...p, category }))
  );
}

function renderCartPanel() {
  // Re-rendering replaces the buttons; remember which one had focus and restore it.
  const active = document.activeElement;
  const focusKey = els.cart.contains(active) ? active.dataset.focusKey ?? "" : null;

  const cart = cartStore.get();
  const totals = cartTotals(cart);
  els.cartHeading.textContent = `Your cart (${totals.count})`;
  renderCart(els.cart, cart, totals, {
    setQty: cartActions.setQty.bind(cartActions),
    remove: cartActions.remove.bind(cartActions),
    clear: cartActions.clear.bind(cartActions),
  });

  if (focusKey !== null) {
    const same = focusKey && els.cart.querySelector(`[data-focus-key="${focusKey}"]`);
    (same || els.cartHeading).focus(); // item gone -> move focus to the cart heading
  }
}

/* ---- Data loading with error handling ------------------------------------ */
async function load({ force = false } = {}) {
  clearBanner(els.banner);
  renderSkeleton(els.grid);
  els.count.textContent = "Loading products…";

  try {
    const [productResult, categoryResult] = await Promise.all([
      fetchProducts({ force }),
      fetchCategories({ force }),
    ]);
    products = productResult.data;
    categories = categoryResult.data;

    // If the saved category no longer exists, fall back to "all".
    if (!["all", ...categories].includes(prefsStore.get().category)) {
      prefsStore.update((p) => ({ ...p, category: "all" }));
    }

    if (productResult.source === "stale-cache") {
      showBanner(els.banner, {
        kind: "warning",
        message: "You are seeing saved products because the live data could not be loaded.",
        onRetry: () => load({ force: true }),
      });
    }
    renderResults();
  } catch (error) {
    products = [];
    categories = [];
    els.grid.setAttribute("aria-busy", "false");
    els.grid.replaceChildren();
    els.count.textContent = "";
    showBanner(els.banner, {
      kind: "error",
      message: error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      onRetry: () => load({ force: true }),
    });
    console.error(error);
  }
}

/* ---- Controls ------------------------------------------------------------- */
function initControls() {
  const prefs = prefsStore.get();

  els.sort.replaceChildren(
    ...Object.entries(SORTS).map(([value, { label }]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    })
  );
  els.sort.value = prefs.sort;
  els.search.value = prefs.query;

  els.search.addEventListener(
    "input",
    debounce(() => prefsStore.update((p) => ({ ...p, query: els.search.value })), 200)
  );
  els.sort.addEventListener("change", () =>
    prefsStore.update((p) => ({ ...p, sort: els.sort.value }))
  );

  // Re-render whenever state changes; only after data has loaded.
  prefsStore.subscribe(() => products.length && renderResults());
  cartStore.subscribe(renderCartPanel);
}

initControls();
renderCartPanel();
load();
