/*
 * What the custom cursor should look like over a given element (spec §2: a dot + a context
 * label). Plain DOM reads (closest / attributes), no layout. Precedence, nearest element first:
 * - text fields → "text": the dot hides and the native I-beam shows;
 * - iframes → "hidden" (the pointer is inside another document);
 * - [data-cursor="LABEL"] on the element or an ancestor → that label ("VIEW", "DRAG", …;
 *   an empty value means "no label");
 * - a <video> → "PLAY"; a link to another site (or target=_blank) → "OPEN" — unless an element
 *   *inside* them carries its own data-cursor;
 * - a button inside a labelled element (and without its own data-cursor) gets no label;
 * - any other link / button → "hover" (a ring); everything else → "default".
 */

export type CursorMode = "default" | "hover" | "label" | "text" | "hidden";
export type CursorLook = { mode: CursorMode; label: string };

const TEXT_FIELD = [
  "textarea",
  "[contenteditable='']",
  "[contenteditable='true']",
  "input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']):not([type='image'])",
].join(",");

const INTERACTIVE = "a[href], button, [role='button'], summary, label, select, input";
/** Controls other than links (a card's own link keeps the card's label). */
const CONTROL = "button, [role='button'], summary, label, select, input";

function isExternal(link: HTMLAnchorElement): boolean {
  if (link.target === "_blank") return true;
  return /^https?:$/.test(link.protocol) && link.origin !== window.location.origin;
}

/** The nearest automatic label: PLAY on videos, OPEN on external links. */
function automatic(target: Element): { el: Element; label: string } | null {
  const video = target.closest("video");
  const link = target.closest<HTMLAnchorElement>("a[href]");
  const external = link && isExternal(link) ? link : null;
  if (video && (!external || external.contains(video))) return { el: video, label: "PLAY" };
  if (external) return { el: external, label: "OPEN" };
  return null;
}

export function resolveCursor(target: Element | null): CursorLook {
  if (!target) return { mode: "hidden", label: "" };
  if (target.closest(TEXT_FIELD)) return { mode: "text", label: "" };
  if (target.closest("iframe")) return { mode: "hidden", label: "" };

  const tagged = target.closest<HTMLElement>("[data-cursor]");
  const auto = automatic(target);
  const interactive = target.closest<HTMLElement>(INTERACTIVE);
  // A control nested inside a labelled element does its own thing ("VIEW" belongs to the card
  // and its link, not to a button inside it): no label unless it carries its own data-cursor.
  const ownControl =
    tagged !== null &&
    interactive !== null &&
    interactive !== tagged &&
    tagged.contains(interactive) &&
    interactive.matches(CONTROL);
  let label = "";
  if (auto && (!tagged || tagged.contains(auto.el))) label = auto.label;
  else if (tagged && !ownControl) label = (tagged.dataset.cursor ?? "").trim().toUpperCase();
  if (label) return { mode: "label", label };

  const disabled =
    interactive?.matches(":disabled") || interactive?.getAttribute("aria-disabled") === "true";
  return { mode: interactive && !disabled ? "hover" : "default", label: "" };
}
