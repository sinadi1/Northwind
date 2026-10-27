/**
 * api.js - REST client for FakeStoreAPI (https://fakestoreapi.com).
 * - async/await + fetch with a timeout (AbortController)
 * - typed ApiError with a user-friendly message
 * - localStorage response cache (5 min). If the network fails and an older
 *   cached copy exists, it is returned so the page still works offline.
 */
import { readJSON, writeJSON } from "./state.js";

export const BASE_URL = "https://fakestoreapi.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.cause = cause;
  }
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BASE_URL + path, { signal: controller.signal });
    if (!response.ok) {
      throw new ApiError(`The server responded with an error (${response.status}).`, {
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new ApiError("The server sent data we could not read.", { cause });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new ApiError("The request took too long. Please try again.");
    }
    throw new ApiError("Could not reach the server. Check your connection.", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET with caching. Resolves to { data, source } where source is
 * "network" | "cache" | "stale-cache".
 */
async function cachedGet(path, { force = false } = {}) {
  const cacheKey = "cache:" + path;
  const cached = readJSON(cacheKey, null);
  const isFresh = cached && Date.now() - cached.time < CACHE_TTL_MS;

  if (isFresh && !force) return { data: cached.data, source: "cache" };

  try {
    const data = await request(path);
    writeJSON(cacheKey, { time: Date.now(), data });
    return { data, source: "network" };
  } catch (error) {
    if (cached) return { data: cached.data, source: "stale-cache" };
    throw error;
  }
}

function assertArray(result, what) {
  if (!Array.isArray(result.data)) {
    throw new ApiError(`Unexpected ${what} data received from the server.`);
  }
  return result;
}

export async function fetchProducts(options) {
  return assertArray(await cachedGet("/products", options), "product");
}

export async function fetchCategories(options) {
  return assertArray(await cachedGet("/products/categories", options), "category");
}
