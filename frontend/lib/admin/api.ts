/**
 * Browser-side client for the admin BFF.
 *
 * Every call goes to `/api/admin/<path>` on this Next.js app; the Route Handler there adds the
 * Bearer token from the httpOnly cookie and forwards to Laravel (`/api/v1/admin/<path>`).
 * The token never reaches browser JavaScript.
 */
import type { ValidationErrors } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: ValidationErrors = {},
    public body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[];

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body (objects/arrays) or FormData (uploads). */
  body?: Json | FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `/api/admin/${path.replace(/^\/+/, "")}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Raw call: returns the parsed JSON body (`{ data, meta? }`). Throws ApiError on non-2xx. */
export async function adminRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    credentials: "same-origin",
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const payload = (parsed ?? {}) as { message?: string; errors?: ValidationErrors };

    if (response.status === 401 && typeof window !== "undefined") {
      // Session gone (expired/revoked token): back to login, keep the current page as `next`.
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // A full reload on purpose: drops every cached admin query along with the dead session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/admin/login?next=${next}`);
    }

    throw new ApiError(
      response.status,
      payload.message ?? `Request failed (${response.status})`,
      payload.errors ?? {},
      parsed,
    );
  }

  return parsed as T;
}

/** Convenience: unwraps `{ data }`. */
export async function adminGet<T>(path: string, query?: RequestOptions["query"]): Promise<T> {
  const res = await adminRequest<{ data: T }>(path, { query });
  return res.data;
}

export async function adminSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: Json | FormData,
): Promise<T> {
  const res = await adminRequest<{ data: T }>(path, { method, body });
  return res.data;
}

/**
 * Upload with progress (fetch cannot report upload progress). Same BFF route.
 * `onProgress` receives 0–1.
 */
export function adminUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error"));
    xhr.onload = () => {
      let parsed: { data?: T; message?: string; errors?: ValidationErrors } | null = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed?.data as T);
      } else {
        reject(
          new ApiError(
            xhr.status,
            parsed?.message ?? `Upload failed (${xhr.status})`,
            parsed?.errors ?? {},
            parsed,
          ),
        );
      }
    };
    xhr.send(form);
  });
}

/** First message per field, for react-hook-form `setError`. Keys keep Laravel's dot notation. */
export function firstErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.errors)) {
    if (messages[0]) out[field] = messages[0];
  }
  return out;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
