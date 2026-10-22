import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Unknown (or unpublished) project slug. A plain on-brand screen for now; the site-wide
 * "GAME OVER — CONTINUE?" 404 arrives in phase 7.
 */
export default function ProjectNotFound() {
  return (
    <section
      aria-labelledby="level-missing"
      className="hk-chapter flex min-h-svh items-center [--chapter-bg:var(--ink)] [--chapter-fg:var(--paper)]"
    >
      <div className="hk-wrap">
        <p className="hk-pixel text-lime mb-6 text-xs md:text-sm">
          <span aria-hidden="true">▸ </span>Error 404 · Stage missing
        </p>
        <h1
          id="level-missing"
          className="hk-display hk-condensed text-[clamp(3.5rem,14vw,10rem)] uppercase"
        >
          Level
          <span className="text-hot block [text-shadow:0.04em_0.04em_0_var(--volt)]">
            not found
          </span>
        </h1>
        <p className="mt-8 max-w-xl text-lg md:text-xl">
          This project doesn&apos;t exist, or it isn&apos;t published yet. Pick another level.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/projects" className="hk-btn hk-btn-hot text-base">
            All projects
          </Link>
          <Link href="/" className="hk-btn text-base">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
