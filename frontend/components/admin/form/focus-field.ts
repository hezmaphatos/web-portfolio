const CONTROLS =
  "input:not([type=hidden]),textarea,select,button[role=combobox],button[role=switch],button[role=checkbox],button";

/**
 * Focuses the first visible control rendered for `path` (or its closest parent path), using the
 * `data-field` attribute every kit field renders. Returns false when nothing visible was found.
 *
 * Every match is checked, not only the first: with Cache Components, pages visited earlier stay
 * in the DOM as hidden copies (React Activity), so `/new` and `/[id]` of the same resource can
 * both render `[data-field="title"]` and the hidden one may come first.
 */
export function focusField(path: string): boolean {
  let current = path;
  while (current) {
    const containers = document.querySelectorAll<HTMLElement>(
      `[data-field="${CSS.escape(current)}"]`,
    );
    for (const container of containers) {
      const target = container.querySelector<HTMLElement>(CONTROLS);
      if (target && target.getClientRects().length > 0) {
        target.focus();
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        return true;
      }
    }
    current = current.includes(".") ? current.slice(0, current.lastIndexOf(".")) : "";
  }
  return false;
}
