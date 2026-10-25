import type { ContactInput } from "@/lib/types";

/*
 * The contact form's client side (spec §4.1 contact, §9 POST /public/contact): validation that
 * mirrors the API's Form Request (backend/app/Http/Requests/Public/ContactRequest.php) and the
 * POST itself. The browser calls the API directly (NEXT_PUBLIC_API_URL) so the 5/hour throttle
 * counts the visitor's own IP; CORS allows only the site's origin.
 */

export type ContactField = "name" | "email" | "message";

export const CONTACT_FIELDS: readonly ContactField[] = ["name", "email", "message"];

/** Same limits as the API: name 2–100, email ≤ 190, message 10–5000. */
export const CONTACT_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 190 },
  message: { min: 10, max: 5000 },
} as const;

export type ContactErrors = Partial<Record<ContactField, string>>;

/**
 * Loose on purpose: the API runs the real RFC check (a 422 is mapped back onto the field).
 * This only catches the obvious typos before a round trip.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One field's error message, or null when it is fine. Values are checked trimmed. */
export function validateContactField(field: ContactField, raw: string): string | null {
  const value = raw.trim();
  switch (field) {
    case "name":
      if (!value) return "Enter your name.";
      if (value.length < CONTACT_LIMITS.name.min) return "Your name needs at least 2 characters.";
      if (value.length > CONTACT_LIMITS.name.max) return "Keep your name under 100 characters.";
      return null;
    case "email":
      if (!value) return "Enter your email address, so I can reply.";
      if (value.length > CONTACT_LIMITS.email.max) return "That email address is too long.";
      if (!EMAIL_SHAPE.test(value)) return "Enter a valid email address, like name@example.com.";
      return null;
    case "message":
      if (!value) return "Write a message.";
      if (value.length < CONTACT_LIMITS.message.min) {
        return "Your message needs at least 10 characters.";
      }
      if (value.length > CONTACT_LIMITS.message.max) {
        return "Keep your message under 5000 characters.";
      }
      return null;
  }
}

/** Every field's error (only the invalid ones are present). */
export function validateContact(input: Pick<ContactInput, ContactField>): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of CONTACT_FIELDS) {
    const error = validateContactField(field, input[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

export type ContactResult =
  | { ok: true }
  /** 422: the API's messages per field (unknown fields dropped); `message` is the summary. */
  | { ok: false; kind: "validation"; errors: ContactErrors; message: string }
  /** 429: the 5-per-hour throttle. */
  | { ok: false; kind: "throttled" }
  /** No answer (offline, DNS, CORS, timeout). */
  | { ok: false; kind: "network" }
  /** Any other status (5xx, 404 …). */
  | { ok: false; kind: "server"; status: number };

const TIMEOUT_MS = 15_000;

function contactUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  return base ? `${base.replace(/\/+$/, "")}/public/contact` : null;
}

type ErrorBody = { message?: unknown; errors?: unknown };

/** Laravel's `{ message, errors: { field: [..] } }` → the first message of each known field. */
function fieldErrors(body: ErrorBody | null): ContactErrors {
  const errors: ContactErrors = {};
  if (!body || typeof body.errors !== "object" || body.errors === null) return errors;
  const source = body.errors as Record<string, unknown>;
  for (const field of CONTACT_FIELDS) {
    const list = source[field];
    if (Array.isArray(list) && typeof list[0] === "string") errors[field] = list[0];
  }
  return errors;
}

/**
 * POST /public/contact. Never throws: every outcome is a ContactResult.
 * A filled honeypot (`website`) still answers 201 — the API simply stores nothing.
 */
export async function sendContact(input: ContactInput): Promise<ContactResult> {
  const url = contactUrl();
  if (!url) return { ok: false, kind: "network" };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        message: input.message.trim(),
        website: input.website,
      }),
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.ok) return { ok: true };
  if (response.status === 429) return { ok: false, kind: "throttled" };
  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    return {
      ok: false,
      kind: "validation",
      errors: fieldErrors(body),
      message: typeof body?.message === "string" ? body.message : "Some fields need another look.",
    };
  }
  return { ok: false, kind: "server", status: response.status };
}
