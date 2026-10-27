/**
 * task-store.js - task data model, per-user persistence, and pure helpers.
 * Tasks are stored under "tasks:<userId>", so each account sees only its own.
 */
import { createStore } from "./state.js";

export const STATUSES = { todo: "To do", "in-progress": "In progress", done: "Done" };
export const PRIORITIES = { low: "Low", medium: "Medium", high: "High" };

export const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

export function newId() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Cleans anything read back from storage so tampered data cannot break rendering. */
export function sanitizeTasks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t.id === "string" && typeof t.title === "string" && t.title.trim())
    .map((t) => ({
      id: t.id,
      title: t.title.trim().slice(0, 120),
      description: typeof t.description === "string" ? t.description.slice(0, 500) : "",
      status: t.status in STATUSES ? t.status : "todo",
      priority: t.priority in PRIORITIES ? t.priority : "medium",
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due ?? "") ? t.due : "",
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now(),
    }));
}

export const tasksStoreFor = (userId) => createStore(`tasks:${userId}`, [], sanitizeTasks);

export function createTaskActions(store) {
  return {
    add: (data) => store.update((list) => [...list, { ...data, id: newId(), createdAt: Date.now() }]),
    update: (id, data) => store.update((list) => list.map((t) => (t.id === id ? { ...t, ...data } : t))),
    remove: (id) => store.update((list) => list.filter((t) => t.id !== id)),
    toggleDone: (id) =>
      store.update((list) =>
        list.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t))),
  };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
export const TASK_SORTS = {
  due: { label: "Due date", compare: (a, b) => (a.due || "9999").localeCompare(b.due || "9999") },
  priority: { label: "Priority", compare: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] },
  newest: { label: "Newest first", compare: (a, b) => b.createdAt - a.createdAt },
  title: { label: "Title A to Z", compare: (a, b) => a.title.localeCompare(b.title) },
};

export function filterTasks(tasks, { status = "all", query = "", sort = "due" } = {}) {
  const needle = query.trim().toLowerCase();
  const result = tasks.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (needle === "" || t.title.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle))
  );
  return result.sort(TASK_SORTS[sort]?.compare ?? TASK_SORTS.due.compare);
}

export const isOverdue = (t, today = todayISO()) => t.status !== "done" && t.due !== "" && t.due < today;

export function summarize(tasks, today = todayISO()) {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
  };
}

export function sampleTasks() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("en-CA");
  };
  const mk = (title, description, status, priority, offset, age) => ({
    id: newId(), title, description, status, priority, due: day(offset), createdAt: Date.now() - age * 3600e3,
  });
  return [
    mk("Prepare sprint review", "Collect demo links and metrics from the team.", "in-progress", "high", 2, 5),
    mk("Fix checkout button contrast", "Button text fails WCAG AA in dark theme.", "todo", "high", -1, 4),
    mk("Write release notes", "Summarise the Store and Tasks features.", "todo", "medium", 5, 3),
    mk("Audit keyboard navigation", "Tab through every page and note focus issues.", "done", "medium", -3, 2),
    mk("Update onboarding email", "", "todo", "low", 9, 1),
  ];
}
