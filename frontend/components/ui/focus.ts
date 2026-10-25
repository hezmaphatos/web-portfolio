/*
 * Focus helpers for the site's two modal surfaces (phase 5): the trophy detail dialog and the
 * chapter menu overlay. Plain DOM functions, no React: the components call them from effects.
 */

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

/** Keyboard-reachable elements inside `root`, in DOM (= Tab) order; hidden ones are skipped. */
export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.closest("[inert]") &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
}

/**
 * Keeps Tab / Shift+Tab inside `root` (cycling). Call from a keydown listener; returns true when
 * it moved the focus itself.
 */
export function trapTab(event: KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const items = focusables(root);
  if (items.length === 0) {
    event.preventDefault();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const inside = active !== null && root.contains(active);
  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/**
 * Makes everything outside `keep` inert (unfocusable, unclickable, hidden from screen readers),
 * walking from each kept element up to <body> and marking the siblings on the way. Elements with
 * `data-inert-keep` (the toast live region) and scripts / dev tooling (custom elements such as
 * <nextjs-portal>) are left alone. Returns the undo function (idempotent).
 */
export function inertOutside(keep: HTMLElement[]): () => void {
  const changed: HTMLElement[] = [];
  const holdsKept = (el: Element) => keep.some((k) => el === k || el.contains(k));

  const consider = (el: Element) => {
    if (!(el instanceof HTMLElement) || el.inert || holdsKept(el)) return;
    if (el.hasAttribute("data-inert-keep")) return;
    if (/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName) || el.tagName.includes("-")) {
      return;
    }
    el.inert = true;
    changed.push(el);
  };

  for (const kept of keep) {
    let node: HTMLElement | null = kept;
    while (node && node !== document.body && node.parentElement) {
      Array.from(node.parentElement.children).forEach(consider);
      node = node.parentElement;
    }
  }

  return () => {
    changed.forEach((el) => (el.inert = false));
    changed.length = 0;
  };
}

/**
 * Moves focus to a heading (or any element) that is not focusable by itself, e.g. a chapter
 * title after a menu jump: a temporary tabindex="-1" that is removed again on blur.
 */
export function focusElement(target: HTMLElement): void {
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.setAttribute("data-focus-target", "");
  target.focus({ preventScroll: true });
}
