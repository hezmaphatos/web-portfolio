"use client";

import { useRef, type RefObject } from "react";

import { gsap, MEDIA, useGSAP } from "@/lib/gsap";

import { revealDelay } from "./rewards";

type Lock = Readonly<{ hydrated: boolean; locked: boolean }>;

/** Lite mode (mirrored on <html data-lite>) or reduced motion: unlocking is instant. */
function still(): boolean {
  return (
    document.documentElement.dataset.lite === "true" || window.matchMedia(MEDIA.reduce).matches
  );
}

type Faces = { item: HTMLElement; open: HTMLElement; lock: HTMLElement };

function facesOf(items: readonly HTMLElement[]): Faces[] {
  const out: Faces[] = [];
  for (const item of items) {
    const open = item.querySelector<HTMLElement>(":scope > [data-unlocked-ui]");
    const lock = item.querySelector<HTMLElement>(":scope > [data-lock-ui]");
    if (open && lock) out.push({ item, open, lock });
  }
  return out;
}

/**
 * The unlock sequence of spec §6.4 step 5, for one lock UI: locked tech chips rotate open (with a
 * stagger) and the lock on Open site / Repo opens. It plays only when the lock opens *live* —
 * `locked` flips to false after the save cookie was read (a defeat, Skip battle) — never when a
 * returning visitor's cookie is read (that page simply renders unlocked).
 *
 * Both faces of a lockable chip/link share one grid cell (same size locked or open), so the
 * animation only moves transform / opacity / clip-path. It starts when the Arena says so
 * (revealDelay: after the hit-stop, dissolve and banner); a lock that is off screen then keeps
 * its locked look and plays the moment it scrolls into view, so the reward is always seen. Lite /
 * reduced motion: the faces simply swap. On completion every inline style is cleared and the CSS
 * state ([aria-hidden] faces) takes over again.
 *
 * `variant`: "chips" = every [data-lockable-chip] inside `scope` (<TechChips>); "links" = `scope`
 * itself when it is a [data-locked-link] (<LockedLink>), else every [data-loot-link] inside it
 * (the Arena's loot list).
 */
export function useUnlockReveal(
  scope: RefObject<HTMLElement | null>,
  lock: Lock,
  projectId: number,
  variant: "chips" | "links",
): void {
  // True while the lock was closed with the cookie already read: opening from there is live.
  const armed = useRef(false);

  useGSAP(
    (_context, contextSafe) => {
      const wasArmed = armed.current;
      armed.current = lock.hydrated && lock.locked;
      const el = scope.current;
      if (lock.locked || !wasArmed || !el || !contextSafe || still()) return;

      const items =
        variant === "chips"
          ? Array.from(el.querySelectorAll<HTMLElement>("[data-lockable-chip]"))
          : el.matches("[data-locked-link]")
            ? [el]
            : Array.from(el.querySelectorAll<HTMLElement>("[data-loot-link]"));
      const faces = facesOf(items);
      if (faces.length === 0) return;

      // Sibling links (Open site, Repo) are separate components: stagger them by DOM order.
      let offset = 0;
      if (el.matches("[data-locked-link]") && el.parentElement) {
        offset =
          Array.from(el.parentElement.querySelectorAll(":scope > [data-locked-link]")).indexOf(el) *
          0.12;
      }

      // Hold the locked look until the sequence starts (applied before paint: no flash).
      const locks = faces.map((f) => f.lock);
      const opens = faces.map((f) => f.open);
      gsap.set(locks, { visibility: "visible" });

      const tl = gsap.timeline({ paused: true });
      faces.forEach(({ open, lock: face }, i) => {
        if (variant === "chips") {
          const at = offset + i * 0.1;
          tl.to(face, { rotationY: 90, duration: 0.16, ease: "power2.in" }, at)
            .set(face, { opacity: 0 }, at + 0.16)
            .fromTo(
              open,
              { rotationY: -90, transformPerspective: 320 },
              { rotationY: 0, duration: 0.34, ease: "back.out(2.2)" },
              at + 0.16,
            );
          gsap.set(face, { transformPerspective: 320 });
        } else {
          const at = offset + i * 0.12;
          const icon = face.querySelector("svg");
          // The shackle pops open, the locked face fades, the live button wipes in (its hard
          // shadow stays inside the clip thanks to the negative insets).
          if (icon) tl.to(icon, { rotation: -28, y: -3, duration: 0.2, ease: "back.out(3)" }, at);
          tl.to(face, { opacity: 0, duration: 0.14, ease: "none" }, at + 0.2).fromTo(
            open,
            { clipPath: "inset(-8px 100% -8px -8px)" },
            { clipPath: "inset(-8px -8px -8px -8px)", duration: 0.4, ease: "power3.out" },
            at + 0.2,
          );
        }
      });
      const icons = locks.flatMap((face) => Array.from(face.querySelectorAll("svg")));
      tl.set([...locks, ...opens, ...icons], {
        clearProps: "transform,opacity,visibility,clipPath",
      });

      const play = contextSafe((wait: number) => {
        gsap.delayedCall(wait, () => void tl.play());
      });

      // Plays when the lock is on screen: right away (after the Arena's delay), or later on scroll.
      let first = true;
      const observer = new IntersectionObserver(
        ([entry]) => {
          const wasFirst = first;
          first = false;
          if (!entry?.isIntersecting) return;
          observer.disconnect();
          // Scrolled into view later: a short beat first, so the flip is seen, not half-missed.
          play(Math.max(revealDelay(projectId) / 1000, wasFirst ? 0 : 0.15));
        },
        { threshold: 0.5 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    },
    { scope, dependencies: [lock.locked, lock.hydrated], revertOnUpdate: true },
  );
}
