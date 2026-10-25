"use client";

import { Send } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { completeStageHint, useStageHint } from "@/components/game/useStageHint";
import { useStill } from "@/components/ui/useStill";
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  sendContact,
  validateContact,
  validateContactField,
  type ContactErrors,
  type ContactField,
} from "@/lib/contact";
import { useGameStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { StageClear } from "./StageClear";

type Props = {
  /** sections.hint of Contact ("Say hi! Send a message to clear the final stage."). */
  hint: string | null;
  className?: string;
};

type Values = Record<ContactField, string>;

const EMPTY: Values = { name: "", email: "", message: "" };

const LABELS: Record<ContactField, string> = {
  name: "Name",
  email: "Email",
  message: "Message",
};

/** Form-level problems (not tied to one field). */
const ALERTS = {
  throttled: "Too many messages — try again later. You can still email me directly.",
  network: "Couldn't reach the server. Check your connection and try again.",
  server: "Something went wrong on my side. Try again in a moment, or email me directly.",
} as const;

/** What the STAGE CLEAR screen echoes back. */
type Cleared = { name: string; email: string; newBadge: boolean };

/**
 * The contact form of FINAL STAGE (spec §4.1 contact, §9 POST /public/contact), mounted at
 * [data-contact-form]. Client validation mirrors the API (name 2–100, email ≤ 190, message
 * 10–5000); the API's 422 messages land on the same fields, 429 / network / 5xx become a
 * form-level alert. Errors are linked with aria-describedby, the first invalid field gets the
 * focus, and a polite live region announces every outcome. Success → STAGE CLEAR (in the form's
 * grid cell, so nothing moves), the Messenger badge and the contact hint are done.
 * `website` is the honeypot: visually hidden, out of the tab order, autocomplete off (bots that
 * fill every field give themselves away; the API then answers 201 and stores nothing).
 * Without JavaScript the whole block is hidden (CSS): the mailto link above is the way.
 */
export function ContactForm({ hint, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const inputs = useRef<Partial<Record<ContactField, HTMLInputElement | HTMLTextAreaElement>>>({});
  const uid = useId();
  const id = (part: string) => `${uid}-${part}`;

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [cleared, setCleared] = useState<Cleared | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const still = useStill();
  const unlockBadge = useGameStore((state) => state.unlockBadge);

  useStageHint("contact", hint, root);

  const focusField = (field: ContactField) => inputs.current[field]?.focus();

  // The live region only speaks when its text changes: the same message twice in a row gets a
  // trailing no-break space, so it is announced again.
  const announce = (text: string) =>
    setAnnouncement((current) => (current === text ? `${text} ` : text));

  const change =
    (field: ContactField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      // A field already marked invalid is re-checked while typing, so the error clears the
      // moment it is fixed (but a new error never pops up mid-word).
      if (errors[field]) {
        setErrors((current) => ({
          ...current,
          [field]: validateContactField(field, value) ?? undefined,
        }));
      }
    };

  const blur = (field: ContactField) => () => {
    const value = values[field];
    if (!value.trim() && !submitted) return; // leaving an empty field is not an error yet
    setErrors((current) => ({
      ...current,
      [field]: validateContactField(field, value) ?? undefined,
    }));
  };

  const announceErrors = (found: ContactErrors) => {
    const fields = CONTACT_FIELDS.filter((field) => found[field]);
    const first = fields[0];
    if (first) focusField(first);
    announce(
      fields.length === 1
        ? `Please check the ${LABELS[fields[0]].toLowerCase()} field.`
        : `Please check ${fields.length} fields: ${fields.map((f) => LABELS[f].toLowerCase()).join(", ")}.`,
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    setAlert(null);

    const found = validateContact(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      announceErrors(found);
      return;
    }

    const honeypot = form.current?.elements.namedItem("website");
    const website = honeypot instanceof HTMLInputElement ? honeypot.value : "";

    setPending(true);
    announce("Sending your message…");
    const result = await sendContact({ ...values, website });
    setPending(false);

    if (result.ok) {
      const newBadge = unlockBadge("messenger");
      completeStageHint("contact");
      setCleared({ name: values.name.trim(), email: values.email.trim(), newBadge });
      setSentCount((count) => count + 1);
      setValues(EMPTY);
      setErrors({});
      setSubmitted(false);
      announce("Message sent. Stage clear!");
      return;
    }

    if (result.kind === "validation") {
      const hasFieldErrors = CONTACT_FIELDS.some((field) => result.errors[field]);
      setErrors(result.errors);
      if (hasFieldErrors) {
        announceErrors(result.errors);
      } else {
        setAlert(result.message);
        announce(result.message);
      }
      return;
    }

    const text = ALERTS[result.kind];
    setAlert(text);
    announce(text);
  };

  const again = () => {
    // Synchronously: the form must be un-inerted before it can take the focus.
    flushSync(() => setCleared(null));
    focusField("name");
  };

  const success = cleared !== null;
  const describedBy = (field: ContactField, extra?: string) =>
    [extra, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <div ref={root} data-contact-form className={cn("hk-contact", className)}>
      <div className="md:col-span-4">
        <p className="hk-pixel text-lime text-xs md:text-sm">
          <span aria-hidden="true">▸ </span>Player 2 · Send a message
        </p>
        <h3
          id={id("title")}
          className="hk-display hk-condensed mt-4 text-[clamp(2.5rem,5.5vw,4rem)] uppercase"
        >
          Leave a message
        </h3>
        <p className="mt-4 max-w-sm text-lg opacity-90">
          Every message lands in my inbox. Your email is only used to reply.
        </p>
      </div>

      <div className="hk-stack md:col-span-8">
        <form
          ref={form}
          noValidate
          onSubmit={submit}
          aria-busy={pending || undefined}
          aria-labelledby={id("title")}
          inert={success}
          className={cn("hk-contact-form", success && "invisible")}
        >
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            <Field id={id("name")} label="Name" error={errors.name} errorId={id("name-error")}>
              <input
                ref={(el) => void (inputs.current.name = el ?? undefined)}
                id={id("name")}
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={CONTACT_LIMITS.name.max}
                value={values.name}
                onChange={change("name")}
                onBlur={blur("name")}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("name")}
                className="hk-input"
              />
            </Field>
            <Field id={id("email")} label="Email" error={errors.email} errorId={id("email-error")}>
              <input
                ref={(el) => void (inputs.current.email = el ?? undefined)}
                id={id("email")}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                required
                maxLength={CONTACT_LIMITS.email.max}
                value={values.email}
                onChange={change("email")}
                onBlur={blur("email")}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("email")}
                className="hk-input"
              />
            </Field>
          </div>

          <Field
            id={id("message")}
            label="Message"
            error={errors.message}
            errorId={id("message-error")}
            aside={
              <span aria-hidden="true" className="hk-mono text-ink-2 text-xs">
                {values.message.length}/{CONTACT_LIMITS.message.max}
              </span>
            }
          >
            <textarea
              ref={(el) => void (inputs.current.message = el ?? undefined)}
              id={id("message")}
              name="message"
              rows={6}
              required
              maxLength={CONTACT_LIMITS.message.max}
              value={values.message}
              onChange={change("message")}
              onBlur={blur("message")}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy("message", id("message-help"))}
              className="hk-input hk-textarea"
            />
            <span id={id("message-help")} className="sr-only">
              At least 10 characters, at most 5000.
            </span>
          </Field>

          {/* Honeypot: never seen, never tabbed to, never autofilled. Not display:none (some bots
              skip hidden inputs); clipped off-screen instead. */}
          <div className="hk-honeypot" aria-hidden="true">
            <label htmlFor={id("website")}>Website (leave this empty)</label>
            <input
              id={id("website")}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="submit"
              className="hk-btn hk-btn-hot hk-send"
              aria-disabled={pending || undefined}
            >
              <span className="grid">
                <span
                  className={cn(
                    "col-start-1 row-start-1 flex items-center justify-center gap-2",
                    pending && "invisible",
                  )}
                >
                  Send message
                  <Send aria-hidden="true" className="size-4" />
                </span>
                <span
                  className={cn(
                    "col-start-1 row-start-1 flex items-center justify-center gap-2",
                    !pending && "invisible",
                  )}
                >
                  Sending
                  <span aria-hidden="true" className="hk-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              </span>
            </button>
            {alert ? <p className="hk-form-alert">{alert}</p> : null}
          </div>
        </form>

        {cleared ? (
          <StageClear
            key={sentCount}
            name={cleared.name}
            email={cleared.email}
            newBadge={cleared.newBadge}
            count={sentCount}
            still={still}
            onAgain={again}
          />
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  errorId,
  aside,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  errorId: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="hk-field">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="hk-field-label hk-pixel">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {/* One line is always reserved, so an error appearing never pushes the form around. */}
      <p id={errorId} className="hk-field-error">
        {error ? (
          <>
            <span aria-hidden="true" className="hk-field-error-mark" />
            {error}
          </>
        ) : null}
      </p>
    </div>
  );
}
