"use client";

import { setHackkerMode } from "./hackerMode";

/**
 * "Exit Hackker Mode" — the way out without typing the code again (HUD menu overlay). Always
 * rendered; CSS shows it only under html[data-theme="hackker"], so it is right from the first
 * paint and takes no focus while the paper theme is on.
 */
export function ExitHackkerButton() {
  return (
    <button
      type="button"
      className="hk-btn hk-exit-hackker"
      onClick={(event) => {
        // The button hides itself with the theme: hand the focus to the Menu button (still
        // inside the menu's focus trap) instead of letting it fall back to <body>.
        const menuButton = event.currentTarget
          .closest("[data-hud]")
          ?.querySelector<HTMLElement>("[aria-controls='hk-menu']");
        setHackkerMode(false);
        menuButton?.focus({ preventScroll: true });
      }}
    >
      <span aria-hidden="true" className="hk-pixel text-xs">
        &gt;_
      </span>
      Exit Hackker Mode
    </button>
  );
}
