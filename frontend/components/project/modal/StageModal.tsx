"use client";

import { X } from "lucide-react";
import { animate } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";

import { lockScroll } from "@/components/providers/SmoothScroll";
import { focusElement, inertOutside, trapTab } from "@/components/ui/focus";
import { useStill } from "@/components/ui/useStill";
import { BOSS_HINT_KEY, BOSS_TUTORIAL_KEY } from "@/lib/hints";
import { useHintStore } from "@/lib/store";

import { StageModalContext, type StageAnnouncement, type StageModalApi } from "./context";
import { EASE_IN, EASE_OUT, FLIP_SECONDS, cssEase, flipFrom, insetFrom, usableBox } from "./flip";

/**
 * "closed": not shown (first render, or hidden by Activity); "waiting": open, the stage is
 * still streaming in (backdrop + loader); "open": the stage is up; "closing": exit running.
 */
type Phase = "closed" | "waiting" | "open" | "closing";

/** Hints that belong to the stage inside the modal; any other hint is about the page behind. */
const STAGE_HINTS = new Set<string>([BOSS_HINT_KEY, BOSS_TUTORIAL_KEY]);

/**
 * The Project Stage as a modal (spec §6.3): the shell of the intercepting route
 * app/(site)/@modal/(.)projects/. It stays mounted while next/previous swaps the project
 * inside it, so the frame never flickers.
 *
 * - Close = router.back() (✕, Esc, backdrop): the URL goes back to the page underneath, which
 *   never unmounted, so Home is exactly where it was. The browser Back button does the same.
 * - While open: page scroll locked (lockScroll → Lenis stop), the rest of the page inert, Tab
 *   trapped in the dialog, focus returned to the card on close. The hint card stays usable (it
 *   sits above, z 55) so the Arena's boss hint works inside the modal; hints of the page
 *   underneath are dismissed while it is open.
 * - Opening animation (Motion, transform/opacity/clip-path only): when a card was clicked the
 *   panel opens out of the card's rect (clip-path) while the stage cover flies from the card to
 *   its place (FLIP); without a card it rises in; Lite / reduced motion: a plain fade.
 *
 * Cache Components keep routes alive with React <Activity> instead of unmounting them: closing
 * only hides this subtree, and its effects clean up / run again exactly like unmount / mount. So
 * everything "per opening" lives in layout effects and every animation starts from explicit
 * values (the DOM may still hold the last close's styles).
 */
export function StageModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const still = useStill();

  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const phase = useRef<Phase>("closed");
  /** A stage that announced itself before the shell's own effect ran (children run first). */
  const pending = useRef<StageAnnouncement | null>(null);
  /** Everything started for the current opening; stopped when it ends (hide or unmount). */
  const running = useRef<{ stop: () => void }[]>([]);
  const stillRef = useRef(still);

  useLayoutEffect(() => {
    stillRef.current = still;
  }, [still]);

  const keep = useCallback(<T extends { stop: () => void }>(controls: T): T => {
    running.current.push(controls);
    return controls;
  }, []);

  const setPhase = useCallback((next: Phase) => {
    phase.current = next;
    if (rootRef.current) rootRef.current.dataset.phase = next;
    panelRef.current?.setAttribute("aria-busy", next === "waiting" ? "true" : "false");
  }, []);

  /** Title + accent of the stage now inside (the dialog is labelled by the stage's <h1>). */
  const label = useCallback((stage: StageAnnouncement) => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.setAttribute("aria-labelledby", stage.titleId);
    panel.style.setProperty("--accent", stage.accent);
  }, []);

  const open = useCallback(
    (stage: StageAnnouncement) => {
      const panel = panelRef.current;
      if (!panel) return;
      setPhase("open");
      label(stage);
      panel.style.opacity = "";
      closeRef.current?.focus({ preventScroll: true });

      // A swap fade cut short by the last close leaves its opacity behind.
      if (stage.root) stage.root.style.opacity = "";
      const parts = Array.from(
        stage.cover?.parentElement?.querySelectorAll<HTMLElement>(
          ":scope > :not([data-stage-cover])",
        ) ?? [],
      );

      if (stillRef.current) {
        keep(animate(panel, { opacity: [0, 1], y: [0, 0] }, { duration: 0.15 }));
        return;
      }

      // Shared element: the panel opens out of the card while the cover flies home. Both run
      // with the same duration and ease, so the flying cover always stays inside the clip.
      const box = panel.getBoundingClientRect();
      const flight =
        stage.from && stage.cover && usableBox(box) ? flipFrom(stage.cover, stage.from) : null;
      if (flight && stage.from) {
        keep(flight);
        // Native WAAPI like the flight (same start frame, see flipFrom). It also leaves nothing
        // behind: Motion would keep the last clip value and re-apply it on the panel's next
        // animation, and a lingering clip would cut off the panel's hard shadow.
        const reveal = panel.animate(
          [{ clipPath: insetFrom(box, stage.from) }, { clipPath: "inset(0px 0px 0px 0px)" }],
          { duration: FLIP_SECONDS * 1000, easing: cssEase(EASE_OUT) },
        );
        keep({ stop: () => reveal.cancel() });
        // The boss sticker next to the cover lands with it (fill: backwards = hidden meanwhile).
        parts.forEach((part) => {
          const fade = part.animate([{ opacity: 0 }, { opacity: 1 }], {
            delay: FLIP_SECONDS * 700,
            duration: 200,
            fill: "backwards",
          });
          keep({ stop: () => fade.cancel() });
        });
        return;
      }

      keep(animate(panel, { opacity: [0, 1], y: [40, 0] }, { duration: 0.4, ease: [...EASE_OUT] }));
    },
    [keep, label, setPhase],
  );

  /** Next / previous inside the open modal: new content, same frame, back at its top. */
  const swap = useCallback(
    (stage: StageAnnouncement) => {
      label(stage);
      scrollerRef.current?.scrollTo({ top: 0 });
      const title = stage.root?.querySelector<HTMLElement>(`[id="${stage.titleId}"]`);
      if (title) focusElement(title); // screen readers hear the new project's name
      if (!stillRef.current && stage.root) {
        keep(animate(stage.root, { opacity: [0, 1] }, { duration: 0.25 }));
      }
    },
    [keep, label],
  );

  const announce = useCallback(
    (stage: StageAnnouncement) => {
      if (phase.current === "open") swap(stage);
      else if (phase.current === "waiting") open(stage);
      else if (phase.current === "closed") pending.current = stage;
    },
    [open, swap],
  );

  const close = useCallback(() => {
    if (phase.current !== "open" && phase.current !== "waiting") return;
    setPhase("closing");
    const back = () => {
      if (phase.current === "closing") router.back();
    };
    const root = rootRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (stillRef.current || !panel || !backdrop) {
      if (root) keep(animate(root, { opacity: [1, 0] }, { duration: 0.12 })).then(back, back);
      else back();
      return;
    }
    keep(animate(backdrop, { opacity: 0 }, { duration: 0.26 }));
    keep(animate(panel, { opacity: 0, y: 28 }, { duration: 0.22, ease: [...EASE_IN] })).then(
      back,
      back,
    );
  }, [keep, router, setPhase]);

  // One opening: every mount and every Activity re-show (forward navigation, the same project
  // clicked again). The cleanup = the modal is gone (unmount or hidden by a back navigation).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!root || !panel || !backdrop) return;

    const html = document.documentElement;
    const active = document.activeElement;
    const trigger = active instanceof HTMLElement && active !== document.body ? active : null;
    const releaseScroll = lockScroll();
    const hintHost = document.querySelector<HTMLElement>(".hk-hint-host");
    const restoreInert = inertOutside(hintHost ? [root, hintHost] : [root]);
    html.dataset.stageModal = "open"; // tints the scrollbar gutter the lock leaves (CSS)
    // Hints of the page behind must not float over the stage: its chapters still count as
    // "in view" under the overlay, so one could auto-open meanwhile. Only the stage's own hints
    // (boss, boss tutorial) — and any hint the visitor asked for — may show.
    const hintFilter = (active: ReturnType<typeof useHintStore.getState>["active"]) => {
      if (active && !active.manual && !STAGE_HINTS.has(active.key)) {
        useHintStore.getState().dismiss();
      }
    };
    hintFilter(useHintStore.getState().active);
    const stopHintFilter = useHintStore.subscribe((state) => hintFilter(state.active));

    // Leftovers of the last close (Activity keeps the DOM as it was).
    root.style.opacity = "";
    panel.style.opacity = "0";
    panel.style.transform = "";
    panel.style.clipPath = "";
    keep(animate(backdrop, { opacity: [0, 1] }, { duration: stillRef.current ? 0.15 : 0.3 }));
    setPhase("waiting");
    closeRef.current?.focus({ preventScroll: true });
    const stage = pending.current;
    pending.current = null;
    if (stage) open(stage);

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return; // e.g. the lightbox handled it
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      trapTab(event, panel);
    };
    document.addEventListener("keydown", onKey);

    const list = running.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      stopHintFilter();
      list.forEach((controls) => controls.stop());
      list.length = 0;
      setPhase("closed");
      if (html.dataset.stageModal) delete html.dataset.stageModal;
      restoreInert();
      // Focus goes back while the page is still locked: a focus handler that scrolls its element
      // into view (the pinned showcase track centres a focused cartridge) can't move the page
      // under the visitor, so Home is exactly where it was.
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      releaseScroll();
    };
  }, [close, keep, open, setPhase]);

  const api = useMemo<StageModalApi>(() => ({ announce }), [announce]);

  return (
    <StageModalContext.Provider value={api}>
      {/*
        display: contents. Next scrolls a freshly navigated segment into view when its first
        element's top is outside [scroll-padding-top, viewport]: our fixed overlay starts at
        y = 0 (< 4rem), which would scroll the page underneath to the top. An element with
        display: contents has no box, so Next skips this segment and the page stays put
        (the page inside wraps itself the same way).
      */}
      <div className="contents">
        <div ref={rootRef} className="hk-stage-modal" data-phase="closed">
          <div
            ref={backdropRef}
            className="hk-stage-modal-backdrop"
            aria-hidden="true"
            onClick={close}
          />
          <p className="hk-stage-modal-loading hk-pixel" aria-hidden="true">
            <span className="hk-stage-modal-caret" /> Loading level…
          </p>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Project"
            className="hk-stage-modal-panel"
          >
            <button
              ref={closeRef}
              type="button"
              className="hk-modal-close hk-stage-modal-close"
              onClick={close}
              aria-label="Close project"
              title="Close (Esc)"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
            </button>
            {/* data-lenis-prevent: Lenis is stopped while the modal is open and would otherwise
                swallow the wheel; the panel scrolls natively. */}
            <div
              ref={scrollerRef}
              className="hk-stage-modal-scroller"
              data-stage-scroller
              data-lenis-prevent
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </StageModalContext.Provider>
  );
}
