/**
 * auth.js - SIMULATED authentication for the capstone demo.
 * Users live in localStorage. Passwords are never stored in plain text:
 * each gets a random salt and is hashed with PBKDF2-SHA256 (150k iterations)
 * through the Web Crypto API. This is still client-side only: a real
 * product must verify credentials on a server.
 */
import { readJSON, writeJSON } from "./state.js";
import { setSession } from "./session.js";
import { sampleTasks } from "./task-store.js";

const ITERATIONS = 150000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 1000;
const encoder = new TextEncoder();

export const DEMO = { name: "Demo User", email: "demo@northwind.test", password: "Demo-Pass-2026" };

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new AuthError("Secure sign-in needs HTTPS or localhost. Open the site over https.");
  }
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return toB64(bits);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const getUsers = () => (Array.isArray(readJSON("users", [])) ? readJSON("users", []) : []);
const normalizeEmail = (e) => String(e).trim().toLowerCase();

function newId() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function validatePassword(password) {
  return password.length >= 12 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

async function createUser({ id, name, email, password }) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user = {
    id: id ?? newId(),
    name: name.trim().slice(0, 80),
    email: normalizeEmail(email),
    salt: toB64(salt),
    hash: await hashPassword(password, salt),
    createdAt: Date.now(),
  };
  writeJSON("users", [...getUsers(), user]);
  return user;
}

export async function register({ name, email, password }) {
  if (!name.trim()) throw new AuthError("Enter your name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthError("Enter a valid email address.");
  if (!validatePassword(password)) {
    throw new AuthError("Use at least 12 characters, including a letter and a number.");
  }
  if (getUsers().some((u) => u.email === normalizeEmail(email))) {
    throw new AuthError("An account with this email already exists. Try signing in.");
  }
  const user = await createUser({ name, email, password });
  return setSession(user);
}

export async function login({ email, password }) {
  const key = normalizeEmail(email);
  const attempts = readJSON("attempts", {});
  const record = attempts[key] ?? { count: 0, until: 0 };

  if (record.until > Date.now()) {
    const seconds = Math.ceil((record.until - Date.now()) / 1000);
    throw new AuthError(`Too many failed attempts. Try again in ${seconds} seconds.`);
  }

  const user = getUsers().find((u) => u.email === key);
  // Hash even for unknown emails so response time does not reveal which emails exist.
  const salt = user ? fromB64(user.salt) : crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);

  if (user && safeEqual(hash, user.hash)) {
    delete attempts[key];
    writeJSON("attempts", attempts);
    return setSession(user);
  }

  const count = record.count + 1;
  attempts[key] = count >= MAX_ATTEMPTS ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 };
  writeJSON("attempts", attempts);
  throw new AuthError("Incorrect email or password.");
}

/** Creates the demo account (with sample tasks) the first time the app runs. */
export async function ensureDemoUser() {
  if (getUsers().some((u) => u.email === DEMO.email)) return;
  await createUser({ id: "demo-user", ...DEMO });
  writeJSON("tasks:demo-user", sampleTasks());
}
