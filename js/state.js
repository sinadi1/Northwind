/**
 * state.js - tiny persistent store on top of localStorage.
 * Every storage call is wrapped in try/catch: storage can be blocked
 * (private mode, quota, disabled) and the app must keep working in memory.
 */
import { getSession } from "./session.js";

const PREFIX = "northwind:";

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * createStore(key, initial, sanitize)
 * Persisted state with subscribe(). `sanitize` cleans whatever was read back
 * from storage so tampered or outdated data cannot break the page.
 */
export function createStore(key, initial, sanitize = (v) => v) {
  let state = sanitize(readJSON(key, initial));
  const listeners = new Set();

  return {
    get: () => state,
    set(next) {
      state = sanitize(next);
      writeJSON(key, state);
      listeners.forEach((fn) => fn(state));
    },
    update(fn) {
      this.set(fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ---- Preferences: search text, category, sort --------------------------- */
const SORT_KEYS = ["default", "price-asc", "price-desc", "rating", "name"];

export const prefsStore = createStore(
  "prefs",
  { query: "", category: "all", sort: "default" },
  (p) => ({
    query: typeof p?.query === "string" ? p.query.slice(0, 100) : "",
    category: typeof p?.category === "string" ? p.category : "all",
    sort: SORT_KEYS.includes(p?.sort) ? p.sort : "default",
  })
);

/* ---- Cart: { [productId]: { id, title, price, image, qty } } ------------- */
export const cartStore = createStore(`cart:${getSession()?.userId ?? "guest"}`, {}, (cart) => {
  const clean = {};
  if (cart && typeof cart === "object") {
    for (const item of Object.values(cart)) {
      const qty = Math.floor(Number(item?.qty));
      const price = Number(item?.price);
      if (item && Number.isFinite(item.id) && Number.isFinite(price) && qty > 0) {
        clean[item.id] = {
          id: item.id,
          title: String(item.title ?? "Product").slice(0, 200),
          price,
          image: typeof item.image === "string" ? item.image : "",
          qty: Math.min(qty, 99),
        };
      }
    }
  }
  return clean;
});

export const cartActions = {
  add(product) {
    cartStore.update((cart) => {
      const existing = cart[product.id];
      return {
        ...cart,
        [product.id]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : { id: product.id, title: product.title, price: product.price, image: product.image, qty: 1 },
      };
    });
  },
  setQty(id, qty) {
    cartStore.update((cart) => {
      const next = { ...cart };
      if (qty <= 0) delete next[id];
      else if (next[id]) next[id] = { ...next[id], qty };
      return next;
    });
  },
  remove(id) {
    this.setQty(id, 0);
  },
  clear() {
    cartStore.set({});
  },
};

export function cartTotals(cart) {
  const items = Object.values(cart);
  return {
    count: items.reduce((n, i) => n + i.qty, 0),
    total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
  };
}
