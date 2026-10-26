"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { useStageModal } from "./context";

/**
 * Suspense fallback of the modal route while a project streams in. On the first opening the
 * panel is still invisible (the shell shows its own loader over the backdrop); when next /
 * previous swaps projects inside the open modal, this line holds the panel meanwhile.
 */
export function StageModalLoading() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center p-8" aria-busy="true">
      <p className="hk-pixel text-sm" role="status">
        <span aria-hidden="true">▸ </span>Loading level…
      </p>
    </div>
  );
}

/** The slug is unknown (or no longer published): say so inside the modal instead of a 404. */
export function StageModalMissing() {
  const ref = useRef<HTMLElement>(null);
  const modal = useStageModal();

  useLayoutEffect(() => {
    modal?.announce({
      titleId: "stage-missing-title",
      accent: "#FF4B2B",
      root: ref.current,
      cover: null,
      from: null,
    });
  }, [modal]);

  return (
    <section
      ref={ref}
      aria-labelledby="stage-missing-title"
      className="hk-chapter flex min-h-[70svh] items-center [--chapter-bg:var(--ink)] [--chapter-fg:var(--paper)]"
    >
      <div className="hk-wrap">
        <p className="hk-pixel text-lime mb-6 text-xs">
          <span aria-hidden="true">▸ </span>Stage missing
        </p>
        <h1
          id="stage-missing-title"
          className="hk-display hk-condensed text-[clamp(3rem,10vw,7rem)] uppercase"
        >
          Level not found
        </h1>
        <p className="mt-6 max-w-xl text-lg">
          This project doesn&apos;t exist, or it isn&apos;t published any more.
        </p>
        <Link href="/projects" className="hk-btn hk-btn-hot mt-8 text-base">
          All projects
        </Link>
      </div>
    </section>
  );
}
