/** dashboard.js - live KPIs and upcoming tasks from the signed-in user's saved data. */
import { getSession } from "./session.js";
import { cartStore, cartTotals } from "./state.js";
import { tasksStoreFor, summarize, filterTasks, isOverdue } from "./task-store.js";
import { el, formatPrice } from "./ui.js";

const session = getSession();
const tasks = tasksStoreFor(session.userId).get();
const counts = summarize(tasks);
const cart = cartTotals(cartStore.get());

const set = (id, text) => { document.getElementById(id).textContent = text; };
set("welcome", `Welcome back, ${session.name}.`);
set("kpi-total", String(counts.total));
set("kpi-total-note", `${counts.todo} to do`);
set("kpi-progress", String(counts.inProgress));
set("kpi-done", String(counts.done));
set("kpi-done-note", counts.total ? `${Math.round((counts.done / counts.total) * 100)}% complete` : "No tasks yet");
set("kpi-overdue", String(counts.overdue));
set("kpi-cart", String(cart.count));
set("kpi-cart-note", cart.count ? `${formatPrice(cart.total)} total` : "Cart is empty");

const upcoming = filterTasks(tasks.filter((t) => t.status !== "done"), { sort: "due" }).slice(0, 5);
const list = document.getElementById("upcoming-list");
list.replaceChildren(
  ...(upcoming.length
    ? upcoming.map((t) => el("li", {},
        el("article", {},
          el("h3", {}, t.title),
          t.due
            ? el("p", {}, "Due ", el("time", { datetime: t.due }, t.due), isOverdue(t) ? " (overdue)" : "")
            : el("p", {}, "No due date"))))
    : [el("li", {}, el("p", {}, "Nothing left to do. "), el("a", { href: "tasks.html" }, "Add a task"))])
);
