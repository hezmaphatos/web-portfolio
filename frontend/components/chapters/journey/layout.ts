import { refreshScrollTriggers } from "@/components/chapters/shared/motion";
import { gsap } from "@/lib/gsap";

/*
 * Layout animations of the Quest Log, without ever animating `height` (spec §2 rule 6: only
 * transform, opacity and clip-path move). The trick, same as Flip's: change the layout
 * instantly, then use transforms/clip-path to make it *look* like it moved from the old layout.
 * Only one layout animation runs at a time: a new one first jumps the previous one to its end,
 * otherwise two of them would fight over the same entries' transforms.
 */

let running: gsap.core.Timeline | null = null;

export function finishRunningLayout(): void {
  running?.progress(1);
  running = null;
}

export function setRunningLayout(timeline: gsap.core.Timeline): void {
  running = timeline;
}

/** The visible entries below `entry`: they slide when it grows or shrinks. */
function followers(entry: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (let el = entry.nextElementSibling; el; el = el.nextElementSibling) {
    if (el instanceof HTMLElement && el.getClientRects().length > 0) result.push(el);
  }
  return result;
}

/**
 * Clip the card's bottom `bottom` px away. The other sides use −12 px so the clip never cuts
 * the hard 6 px shadow.
 */
const clipBottom = (bottom: number) => `inset(-12px -12px ${bottom}px -12px)`;

/**
 * Opens or closes one quest entry ([data-accordion] with [data-accordion-body]).
 * - open: the body appears instantly (layout), then the card is clipped back to its old height
 *   and the clip slides open, while the entries below start where they were (translateY) and
 *   slide down in sync;
 * - close: the reverse, and the layout change comes at the end.
 * `animate` false (Lite / reduced motion): just the instant layout change.
 * Calls `done` when the layout is final.
 */
export function toggleQuestEntry(
  entry: HTMLElement,
  open: boolean,
  animate: boolean,
  done: () => void,
): gsap.core.Timeline | null {
  finishRunningLayout();
  const card = entry.querySelector<HTMLElement>("article");
  const body = entry.querySelector<HTMLElement>("[data-accordion-body]");

  if (!animate || !card || !body) {
    entry.dataset.open = String(open);
    refreshScrollTriggers();
    done();
    return null;
  }

  const below = followers(entry);
  const before = { entry: entry.offsetHeight, card: card.offsetHeight };
  // Measure the other state (offsetHeight forces a synchronous layout; fine for one card).
  entry.dataset.open = String(open);
  const after = { entry: entry.offsetHeight, card: card.offsetHeight };
  const shift = after.entry - before.entry; // > 0 when opening
  const cardShift = Math.abs(after.card - before.card);

  const finish = () => {
    gsap.set([card, body, ...below], { clearProps: "clipPath,opacity,transform" });
    refreshScrollTriggers(); // the page got taller/shorter: every ScrollTrigger re-measures
    done();
  };

  let timeline: gsap.core.Timeline;
  if (open) {
    timeline = gsap
      .timeline({ defaults: { duration: 0.45, ease: "power3.out" }, onComplete: finish })
      .fromTo(card, { clipPath: clipBottom(cardShift) }, { clipPath: clipBottom(-12) }, 0)
      .fromTo(below, { y: -shift }, { y: 0 }, 0)
      .fromTo(body, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35 }, 0.08);
  } else {
    entry.dataset.open = "true"; // keep the body until the clip has closed over it
    timeline = gsap
      .timeline({
        defaults: { duration: 0.35, ease: "power2.inOut" },
        onComplete: () => {
          entry.dataset.open = "false";
          finish();
        },
      })
      .to(body, { opacity: 0, duration: 0.2 }, 0)
      .fromTo(card, { clipPath: clipBottom(-12) }, { clipPath: clipBottom(cardShift) }, 0)
      .to(below, { y: shift }, 0); // shift < 0: they rise into the space the body leaves
  }
  setRunningLayout(timeline);
  return timeline;
}
