/**
 * tasks.js - Task Manager page: full CRUD with per-user persistence.
 *   Create: "New task" dialog   Read: filtered/sorted list
 *   Update: Edit dialog + done checkbox   Delete: confirm dialog
 */
import { getSession } from "./session.js";
import { createStore } from "./state.js";
import {
  tasksStoreFor, createTaskActions, filterTasks, summarize, isOverdue,
  STATUSES, PRIORITIES, TASK_SORTS, todayISO,
} from "./task-store.js";
import { el } from "./ui.js";
import { debounce } from "./filters.js";

const session = getSession();
const store = tasksStoreFor(session.userId);
const actions = createTaskActions(store);
const prefs = createStore(
  `task-prefs:${session.userId}`,
  { status: "all", query: "", sort: "due" },
  (p) => ({
    status: p?.status === "all" || p?.status in STATUSES ? p.status : "all",
    query: typeof p?.query === "string" ? p.query.slice(0, 100) : "",
    sort: p?.sort in TASK_SORTS ? p.sort : "due",
  })
);

const $ = (id) => document.getElementById(id);
const els = {
  list: $("task-list"), count: $("task-count"), heading: $("task-list-heading"),
  tabs: $("status-tabs"), search: $("task-search"), sort: $("task-sort"),
  newButton: $("new-task-button"),
  dialog: $("task-dialog"), form: $("task-form"), dialogTitle: $("task-dialog-title"), submit: $("task-submit"),
  deleteDialog: $("delete-dialog"), confirmDelete: $("confirm-delete"),
};

let editingId = null;
let deletingId = null;
let focusAfterClose = null;

const formatDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ---- Rendering ----------------------------------------------------------- */
function renderTabs(all) {
  const counts = summarize(all);
  const items = [
    ["all", "All", counts.total],
    ["todo", STATUSES.todo, counts.todo],
    ["in-progress", STATUSES["in-progress"], counts.inProgress],
    ["done", STATUSES.done, counts.done],
  ];
  if (els.tabs.children.length !== items.length) {
    els.tabs.replaceChildren(
      ...items.map(([key]) => {
        const b = el("button", { type: "button", class: "tab", dataset: { status: key } });
        b.addEventListener("click", () => prefs.update((p) => ({ ...p, status: key })));
        return b;
      })
    );
  }
  // Update in place so keyboard focus is never lost.
  items.forEach(([key, label, n], i) => {
    const b = els.tabs.children[i];
    b.textContent = `${label} (${n})`;
    b.setAttribute("aria-pressed", String(prefs.get().status === key));
  });
}

function taskItem(t) {
  const check = el("input", {
    type: "checkbox", id: `check-${t.id}`, checked: t.status === "done",
    dataset: { focusKey: `check-${t.id}` },
  });
  check.checked = t.status === "done";
  check.addEventListener("change", () => actions.toggleDone(t.id));

  const edit = el("button", { type: "button", class: "btn btn-secondary btn-small", dataset: { focusKey: `edit-${t.id}` } },
    "Edit", el("span", { class: "visually-hidden" }, ` ${t.title}`));
  edit.addEventListener("click", () => openEditor(t));
  const del = el("button", { type: "button", class: "btn btn-danger btn-small" },
    "Delete", el("span", { class: "visually-hidden" }, ` ${t.title}`));
  del.addEventListener("click", () => { deletingId = t.id; els.deleteDialog.returnFocusTo = null; focusAfterClose = null; els.deleteDialog.showModal(); });

  const meta = el("p", { class: "task-meta" },
    el("span", { class: `badge badge-${t.priority}` }, `${PRIORITIES[t.priority]} priority`),
    el("span", { class: `badge ${t.status === "done" ? "badge-active" : t.status === "in-progress" ? "badge-pending" : "badge-inactive"}` }, STATUSES[t.status]),
    t.due ? el("span", { class: isOverdue(t) ? "overdue" : "" },
      "Due ", el("time", { datetime: t.due }, formatDate(t.due)), isOverdue(t) ? " (overdue)" : "") : null
  );

  return el("li", {},
    el("article", { class: `task-card${t.status === "done" ? " is-done" : ""}` },
      el("div", { class: "task-check" }, check,
        el("label", { for: `check-${t.id}`, class: "visually-hidden" }, `Mark done: ${t.title}`)),
      el("div", { class: "task-body" },
        el("h3", { class: "task-title" }, t.title),
        t.description ? el("p", { class: "task-desc" }, t.description) : null,
        meta),
      el("div", { class: "task-actions" }, edit, del))
  );
}

function render() {
  // Remember focus inside the list, restore it after rebuilding the nodes.
  const active = document.activeElement;
  const focusKey = els.list.contains(active) ? active.dataset.focusKey ?? "" : null;

  const all = store.get();
  const visible = filterTasks(all, prefs.get());
  renderTabs(all);

  if (visible.length === 0) {
    els.list.replaceChildren(el("li", { class: "empty-state" },
      all.length === 0 ? "No tasks yet. Use “New task” to add your first one."
                       : "No tasks match your filters."));
  } else {
    els.list.replaceChildren(...visible.map(taskItem));
  }
  els.count.textContent = `Showing ${visible.length} of ${all.length} tasks`;

  if (focusKey !== null) {
    (focusKey && els.list.querySelector(`[data-focus-key="${focusKey}"]`) || els.heading).focus();
  }
}

/* ---- Create / update ----------------------------------------------------- */
function openEditor(task = null) {
  editingId = task?.id ?? null;
  els.form.reset(); // also clears old validation messages
  els.dialogTitle.textContent = task ? "Edit task" : "New task";
  els.submit.textContent = task ? "Save changes" : "Add task";
  if (task) {
    els.form.elements.title.value = task.title;
    els.form.elements.description.value = task.description;
    els.form.elements.status.value = task.status;
    els.form.elements.priority.value = task.priority;
    els.form.elements.due.value = task.due;
  }
  els.form.elements.description.dispatchEvent(new Event("input")); // refresh character counter
  focusAfterClose = task ? `edit-${task.id}` : "new";
  els.dialog.returnFocusTo = null; // we restore focus ourselves (list nodes get rebuilt)
  els.dialog.showModal();
}

els.form.addEventListener("form:valid", () => {
  const f = els.form.elements;
  const data = {
    title: f.title.value.trim(),
    description: f.description.value.trim(),
    status: f.status.value,
    priority: f.priority.value,
    due: f.due.value,
  };
  if (editingId) actions.update(editingId, data); else actions.add(data);
});

els.dialog.addEventListener("close", () => {
  const target = focusAfterClose && focusAfterClose !== "new"
    ? els.list.querySelector(`[data-focus-key="${focusAfterClose}"]`) : null;
  (target || els.newButton).focus();
});

/* ---- Delete --------------------------------------------------------------- */
els.confirmDelete.addEventListener("click", () => {
  if (deletingId) actions.remove(deletingId);
  deletingId = null;
  els.deleteDialog.close();
  els.heading.focus();
});

/* ---- Controls -------------------------------------------------------------- */
els.sort.replaceChildren(
  ...Object.entries(TASK_SORTS).map(([value, { label }]) => el("option", { value }, label))
);
els.sort.value = prefs.get().sort;
els.search.value = prefs.get().query;

els.newButton.addEventListener("click", () => openEditor());
els.search.addEventListener("input", debounce(() => prefs.update((p) => ({ ...p, query: els.search.value })), 200));
els.sort.addEventListener("change", () => prefs.update((p) => ({ ...p, sort: els.sort.value })));

store.subscribe(render);
prefs.subscribe(render);
render();

// Keep the "today" boundary honest if the tab stays open past midnight.
let day = todayISO();
setInterval(() => { if (todayISO() !== day) { day = todayISO(); render(); } }, 60 * 1000);
