import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "lf_session_token";
const BASE_KEY = "lf_api_base";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function defaultBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  // Android emulator reaches the host machine through 10.0.2.2.
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}

let baseUrl = defaultBaseUrl();
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function getBaseUrl(): string {
  return baseUrl;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Loads the persisted session/base URL. Called once at app start. */
export async function restoreSession(): Promise<string | null> {
  const storedBase = await SecureStore.getItemAsync(BASE_KEY);
  if (storedBase) baseUrl = storedBase.replace(/\/$/, "");
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, next);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setBaseUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, "");
  baseUrl = clean || defaultBaseUrl();
  if (clean) await SecureStore.setItemAsync(BASE_KEY, clean);
  else await SecureStore.deleteItemAsync(BASE_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, auth = true, query } = options;
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (response.status === 401 && auth) {
    onUnauthorized?.();
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ?? {} }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", form }),
};

/** Uploads one picked image and returns its public path (e.g. `/api/files/x.jpg`). */
export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  const name = `photo-${Date.now()}.jpg`;
  form.append("files", { uri, name, type: "image/jpeg" } as unknown as Blob);
  const result = await api.postForm<{ paths: string[] }>("/api/uploads", form);
  const path = result.paths[0];
  if (!path) throw new ApiError(500, "Upload failed");
  return path;
}

export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${baseUrl}${path}`;
}
