import Link from "next/link";

import { PixelAvatar } from "@/components/game/PixelAvatar";

import { ContinuePrompt } from "./ContinuePrompt";

type Props = {
  /** `page`: unknown URL. `level`: unknown (or unpublished) project slug. */
  variant?: "page" | "level";
};

const COPY = {
  page: {
    kicker: "Error 404 · Page not found",
    body: "You walked off the edge of the map. This page doesn't exist, or it moved somewhere else.",
  },
  level: {
    kicker: "Error 404 · Level not found",
    body: "This level doesn't exist, or it isn't published yet. Pick another one from the level select.",
  },
} as const;

/**
 * The site's 404 (spec §4 `/not-found`): "GAME OVER — CONTINUE?" in the paper theme (§2).
 * Server-rendered and complete without JavaScript; only <ContinuePrompt> is a client island.
 * Used by the root app/not-found.tsx (unknown URLs, wrapped in the site layout) and the
 * project-slug not-found.
 */
export function GameOver({ variant = "page" }: Props) {
  const copy = COPY[variant];

  return (
    <section aria-labelledby="hk-go-title" className="hk-chapter hk-go">
      <div className="hk-wrap hk-go-grid">
        <div className="hk-go-copy">
          <p className="hk-pixel text-ink-2 mb-5 text-xs md:mb-7 md:text-sm">
            <span aria-hidden="true">▸ </span>
            {copy.kicker}
          </p>
          <h1
            id="hk-go-title"
            className="hk-display hk-condensed hk-go-title text-[clamp(4.25rem,19vw,11.5rem)] uppercase"
          >
            Game
            <span className="text-hot block [text-shadow:0.045em_0.045em_0_var(--ink)]">over</span>
          </h1>
          <p className="mt-6 max-w-md text-lg md:mt-8 md:text-xl">{copy.body}</p>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/projects" className="hk-link font-semibold">
              All projects <span aria-hidden="true">▸</span>
            </Link>
            <Link href="/#contact" className="hk-link font-semibold">
              Report a broken link
            </Link>
          </p>
        </div>

        <div className="hk-go-side">
          {/* The fallen hero: decorative, lying next to the prompt. */}
          <div className="hk-go-ko" aria-hidden="true">
            <PixelAvatar scale={5} />
            <span className="hk-go-ko-tag hk-pixel">KO</span>
          </div>
          <ContinuePrompt titleId="hk-go-continue" />
        </div>
      </div>
    </section>
  );
}
