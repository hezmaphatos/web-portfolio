"use client";

import { ArrowRight, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Media } from "@/components/ui/Media";
import { cn, formatYears, label } from "@/lib/utils";

import { BossBadge } from "./BossBadge";
import type { PeekProject } from "./PeekProvider";
import { TechChips } from "./TechChips";
import { rememberCardRect } from "./transition";

type Props = {
  project: PeekProject;
  /** Lite / reduced motion: a plain fade, no slide. */
  still: boolean;
  onClose: () => void;
  /** "Open level" was followed: close without handing focus back (the Stage takes over). */
  onNavigate: () => void;
};

/** Quart-out: quick start, soft landing. */
const EASE_OUT = [0.25, 1, 0.5, 1] as const;

/**
 * The Peek quick preview (spec §6.2): mini gallery of the project's `peek` images (or its cover /
 * generative placeholder), kicker, title, tagline, summary, boss sticker, gated tech chips and
 * "Open level". A child of <AnimatePresence> in <PeekProvider>, which owns the modal behaviour.
 * Motion: the layer fades and the panel rises a little (transform + opacity only).
 */
export function PeekDialog({ project, still, onClose, onNavigate }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(0);

  const images = project.peek.length > 0 ? project.peek : [project.cover];
  const years = formatYears(project.year_start, project.year_end);
  const kicker = [label(project.category), years, label(project.kind)].filter(Boolean).join(" · ");

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  /** Arrow keys walk the thumbnails (and move focus with them), Home/End jump to the ends. */
  const onThumbKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = images.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = index >= last ? 0 : index + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index <= 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setIndex(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  return (
    <motion.div
      className="hk-modal hk-peek"
      style={{ "--peek-accent": project.accent_color } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: still ? 0.12 : 0.22 }}
    >
      <div className="hk-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="hk-modal-frame">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="hk-modal-panel hk-peek-panel"
          initial={still ? false : { y: 28, scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={still ? undefined : { y: 14, scale: 0.985 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        >
          <button
            ref={closeButton}
            type="button"
            className="hk-modal-close"
            onClick={onClose}
            aria-label="Close preview"
            title="Close (Esc)"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </button>

          {/* data-lenis-prevent: Lenis is stopped while the dialog is open and would otherwise
              swallow the wheel; this lets a tall dialog scroll natively inside itself. */}
          <div className="hk-modal-body" data-lenis-prevent>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
              <figure className="min-w-0">
                <div ref={frame} className="hk-peek-frame" data-peek-frame>
                  {images.map((media, i) => (
                    <div
                      key={media?.id ?? `cover-${i}`}
                      className={cn("hk-peek-slide", i === index && "is-on")}
                      aria-hidden={i === index ? undefined : true}
                    >
                      <Media
                        media={media}
                        alt={`${project.title}, screenshot ${i + 1}`}
                        seed={project.slug}
                        accent={project.accent_color}
                        ratio={16 / 10}
                        sizes="(min-width: 768px) 26rem, 90vw"
                        className="h-full"
                      />
                    </div>
                  ))}
                </div>
                {images.length > 1 ? (
                  <div
                    role="group"
                    aria-label="Screenshots"
                    className="mt-3 flex gap-2"
                    onKeyDown={onThumbKey}
                  >
                    {images.map((media, i) => (
                      <button
                        key={media?.id ?? `thumb-${i}`}
                        type="button"
                        className="hk-peek-thumb"
                        aria-pressed={i === index}
                        aria-label={`Show screenshot ${i + 1} of ${images.length}`}
                        tabIndex={i === index ? 0 : -1}
                        onClick={() => setIndex(i)}
                      >
                        <Media
                          media={media}
                          alt=""
                          seed={`${project.slug}-${i}`}
                          accent={project.accent_color}
                          ratio={16 / 10}
                          thumb
                          sizes="5rem"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                <figcaption className="hk-pixel mt-2 text-[0.6875rem] opacity-75">
                  {images.length > 1
                    ? `Screenshot ${index + 1} / ${images.length}`
                    : project.peek.length > 0
                      ? "Screenshot"
                      : "Cover"}
                </figcaption>
              </figure>

              <div className="flex min-w-0 flex-col gap-3">
                <p className="hk-pixel text-ink-2 pr-12 text-xs">{kicker}</p>
                <h2
                  id={titleId}
                  className="hk-display hk-condensed text-[clamp(2.25rem,6vw,3.25rem)] text-balance uppercase"
                >
                  {project.title}
                </h2>
                {project.tagline ? <p className="text-lg leading-snug">{project.tagline}</p> : null}
                {project.summary ? (
                  <p className="text-ink-2 line-clamp-4 text-[0.9375rem]">{project.summary}</p>
                ) : null}
                <BossBadge
                  boss={project.boss}
                  withName
                  size="sm"
                  projectId={project.id}
                  className="mt-1 self-start"
                />
                <TechChips
                  skills={project.skills}
                  projectId={project.id}
                  bossEnabled={project.boss.enabled}
                  className="pt-1"
                />
                <div className="mt-auto pt-4">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="hk-btn hk-btn-hot"
                    data-magnetic
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                        return;
                      }
                      rememberCardRect(project.id, frame.current);
                      onNavigate();
                    }}
                  >
                    Open level
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
