/**
 * session.js - the signed-in user's session (simulated auth).
 * Intentionally has no imports so state.js can depend on it without a cycle.
 * guard.js (a classic script) reads the same key synchronously in <head>.
 */
export const SESSION_KEY = "northwind:session";
const SESSION_HOURS = 8;

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.userId !== "string" || !(s.expires > Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

export function setSession(user) {
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    expires: Date.now() + SESSION_HOURS * 3600 * 1000,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: user simply stays signed out */
  }
  return session;
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Only allow redirects to a page in this site, e.g. "tasks.html" (no open redirects). */
export function safeNext(value, fallback = "index.html") {
  return typeof value === "string" && /^[a-z-]+\.html$/.test(value) ? value : fallback;
}
