/**
 * ui.js - DOM rendering. Elements are built with createElement/textContent
 * (never innerHTML with API data) so remote content cannot inject markup.
 */
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (n) => money.format(n);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children);
  return node;
}

/* ---- Loading skeleton --------------------------------------------------- */
export function renderSkeleton(container, count = 8) {
  container.setAttribute("aria-busy", "true");
  container.replaceChildren(
    ...Array.from({ length: count }, () =>
      el("li", { class: "product-card skeleton", "aria-hidden": "true" },
        el("div", { class: "skeleton-block skeleton-image" }),
        el("div", { class: "skeleton-block skeleton-line" }),
        el("div", { class: "skeleton-block skeleton-line short" })
      )
    )
  );
}

/* ---- Error / info banner ------------------------------------------------ */
export function showBanner(container, { message, kind = "error", onRetry } = {}) {
  const children = [el("p", { class: "banner-text" }, message)];
  if (onRetry) {
    const retry = el("button", { type: "button", class: "btn btn-small" }, "Try again");
    retry.addEventListener("click", onRetry);
    children.push(retry);
  }
  container.replaceChildren(el("div", { class: `banner banner-${kind}` }, ...children));
}

export function clearBanner(container) {
  container.replaceChildren();
}

/* ---- Category buttons ---------------------------------------------------- */
export function renderCategories(container, categories, active, onSelect) {
  const all = ["all", ...categories];
  const existing = [...container.querySelectorAll("button")];

  // Same buttons as before: only update their state, so keyboard focus is not lost.
  if (existing.length === all.length && existing.every((b, i) => b.dataset.category === all[i])) {
    existing.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.category === active)));
    return;
  }

  container.replaceChildren(
    ...all.map((cat) => {
      const btn = el(
        "button",
        { type: "button", class: "tab", "aria-pressed": String(cat === active), dataset: { category: cat } },
        cat === "all" ? "All" : cat
      );
      btn.addEventListener("click", () => onSelect(cat));
      return btn;
    })
  );
}

/* ---- Product grid -------------------------------------------------------- */
export function renderProducts(container, products, onAdd) {
  container.setAttribute("aria-busy", "false");

  if (products.length === 0) {
    container.replaceChildren(
      el("li", { class: "empty-state" }, "No products match your search. Try a different word or category.")
    );
    return;
  }

  container.replaceChildren(
    ...products.map((p) => {
      const add = el("button", { type: "button", class: "btn btn-small" },
        "Add to cart", el("span", { class: "visually-hidden" }, ` ${p.title}`));
      add.addEventListener("click", () => onAdd(p));

      return el("li", {},
        el("article", { class: "product-card" },
          el("img", { src: p.image, alt: "", width: "200", height: "200", loading: "lazy" }),
          el("span", { class: "badge badge-inactive category-badge" }, p.category),
          el("h3", { class: "product-title" }, p.title),
          el("p", { class: "product-meta" },
            el("strong", {}, formatPrice(p.price)),
            ` · Rating ${p.rating?.rate ?? "n/a"} (${p.rating?.count ?? 0})`),
          add
        )
      );
    })
  );
}

/* ---- Cart ---------------------------------------------------------------- */
export function renderCart(container, cart, { count, total }, handlers) {
  const items = Object.values(cart);

  if (items.length === 0) {
    container.replaceChildren(el("p", { class: "empty-cart" }, "Your cart is empty."));
    return;
  }

  const list = el("ul", { class: "cart-list" },
    ...items.map((item) => {
      const minus = el("button", { type: "button", class: "btn btn-secondary btn-small",
        "aria-label": `Decrease quantity of ${item.title}`, dataset: { focusKey: `minus-${item.id}` } }, "−");
      const plus = el("button", { type: "button", class: "btn btn-secondary btn-small",
        "aria-label": `Increase quantity of ${item.title}`, dataset: { focusKey: `plus-${item.id}` } }, "+");
      const remove = el("button", { type: "button", class: "btn btn-danger btn-small" },
        "Remove", el("span", { class: "visually-hidden" }, ` ${item.title}`));

      minus.addEventListener("click", () => handlers.setQty(item.id, item.qty - 1));
      plus.addEventListener("click", () => handlers.setQty(item.id, item.qty + 1));
      remove.addEventListener("click", () => handlers.remove(item.id));

      return el("li", { class: "cart-item" },
        el("p", { class: "cart-item-title" }, item.title),
        el("p", { class: "cart-item-line" },
          minus, el("span", { class: "qty" }, String(item.qty)), plus,
          el("span", { class: "cart-item-price" }, formatPrice(item.price * item.qty))),
        remove
      );
    })
  );

  const clear = el("button", { type: "button", class: "btn btn-secondary btn-small" }, "Clear cart");
  clear.addEventListener("click", handlers.clear);

  container.replaceChildren(
    list,
    el("p", { class: "cart-total" }, `Total (${count} ${count === 1 ? "item" : "items"}): `,
      el("strong", {}, formatPrice(total))),
    clear
  );
}
