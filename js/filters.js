/** filters.js - pure functions: search, category filter and sorting. */

export const SORTS = {
  default: { label: "Featured", compare: null },
  "price-asc": { label: "Price: low to high", compare: (a, b) => a.price - b.price },
  "price-desc": { label: "Price: high to low", compare: (a, b) => b.price - a.price },
  rating: { label: "Top rated", compare: (a, b) => (b.rating?.rate ?? 0) - (a.rating?.rate ?? 0) },
  name: { label: "Name: A to Z", compare: (a, b) => a.title.localeCompare(b.title) },
};

export function applyFilters(products, { query = "", category = "all", sort = "default" } = {}) {
  const needle = query.trim().toLowerCase();

  let result = products.filter((p) => {
    const inCategory = category === "all" || p.category === category;
    const matches =
      needle === "" ||
      p.title.toLowerCase().includes(needle) ||
      String(p.description ?? "").toLowerCase().includes(needle);
    return inCategory && matches;
  });

  const compare = SORTS[sort]?.compare;
  if (compare) result = [...result].sort(compare); // copy: never mutate the source list

  return result;
}

export function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
