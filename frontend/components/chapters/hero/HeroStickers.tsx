"use client";

import { useMounted } from "@/components/chapters/shared/motion";
import { cn } from "@/lib/utils";

import { tossStickers } from "./stickers";

type Sticker = { key: string; text: string };

/** Where each stat sticker sits (and its parallax depth): decorative, so it's hand-placed. */
const PLACES = [
  { depth: "1", place: "top-2 left-[46%]", look: "bg-lime rotate-3" },
  { depth: "1.4", place: "right-[2%] bottom-[38%]", look: "bg-volt text-paper -rotate-2" },
];

/**
 * The stat stickers of the Hero (desktop only; the same facts are in About). Without JS they are
 * plain decoration: `inert` + aria-hidden keep them out of the tab order and the screen reader.
 * Once hydrated each one is a real button — <HeroScene> makes it draggable and lets the arrow
 * keys nudge it (Enter/Space throws it), the keyboard alternative required by spec §11.
 */
export function HeroStickers({ stickers }: { stickers: Sticker[] }) {
  const mounted = useMounted();

  return (
    <div
      className="pointer-events-none absolute inset-0 hidden md:block"
      inert={!mounted}
      aria-hidden={mounted ? undefined : true}
    >
      <p id="hero-sticker-help" className="sr-only">
        Arrow keys move the sticker, Shift moves it further, Enter throws it.
      </p>
      {stickers.slice(0, PLACES.length).map((sticker, i) => (
        <span
          key={sticker.key}
          data-depth={PLACES[i].depth}
          className={cn("absolute", PLACES[i].place)}
        >
          <button
            type="button"
            data-sticker
            aria-label={`Sticker: ${sticker.text}`}
            aria-describedby="hero-sticker-help"
            className={cn(
              "hk-panel-flat hk-pixel hk-sticker-btn pointer-events-auto relative px-3 py-2 text-xs shadow-[3px_3px_0_var(--ink)]",
              PLACES[i].look,
            )}
          >
            {sticker.text}
          </button>
        </span>
      ))}
    </div>
  );
}

/** "Toss stickers": throws every sticker at once — the button alternative to dragging. */
export function StickerToss() {
  const mounted = useMounted();
  return (
    <button
      type="button"
      onClick={tossStickers}
      // Invisible (but holding its box) until JS can actually throw something.
      className={cn("hk-btn hk-pixel min-h-9 px-3 py-1.5 text-[0.7rem]", !mounted && "invisible")}
    >
      <span aria-hidden="true">✦</span> Toss stickers
    </button>
  );
}
