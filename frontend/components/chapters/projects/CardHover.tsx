"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useStill } from "@/components/ui/useStill";
import { gsap, MEDIA } from "@/lib/gsap";
import type { Media } from "@/lib/types";

import { useMediaQuery } from "./useMediaQuery";

type Props = {
  /** Second visual: the first gallery image that is not the cover (API `hover_image`). */
  image: Media | null;
  /** Short muted loop (API `hover_video`); wins over the image when both exist. */
  video: Media | null;
  sizes: string;
};

/** Maximum tilt in degrees around the horizontal / vertical axis. Subtle on purpose. */
const TILT_X = 3.5;
const TILT_Y = 4.5;

const clamp01 = gsap.utils.clamp(0, 1);

/**
 * Hover layer of a grid card (spec §6.2, desktop with a fine pointer, not Lite / reduced motion):
 * - the cover crossfades to the hover video or the second image. Nothing is fetched until the
 *   first hover: the <video> (muted, looping, preload="none") or <Image> only mounts then, and the
 *   layer fades in (opacity) once the video plays / the image has loaded; the video pauses on leave;
 * - the card tilts a little towards the pointer (GSAP quickTo on rotationX/Y, transform only).
 *
 * Lives inside [data-card-cover] (absolute, under the boss sticker and the stretched link) and
 * finds its card with closest("[data-grid-item]"). The Flip filter moves the card's <li>, the
 * tilt the <article>: two different elements, so they never fight over `transform`.
 */
export function CardHover({ image, video, sizes }: Props) {
  const layer = useRef<HTMLSpanElement>(null);
  const clip = useRef<HTMLVideoElement>(null);
  const hovering = useRef(false);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const fine = useMediaQuery(MEDIA.finePointer);
  const still = useStill();
  const enabled = fine && !still;

  const videoSrc = video && video.mime.startsWith("video/") ? video.url : null;
  const imageSrc =
    !videoSrc && image && image.mime.startsWith("image/") ? (image.thumb_url ?? image.url) : null;

  useEffect(() => {
    const card = layer.current?.closest<HTMLElement>("[data-grid-item]");
    if (!card || !enabled) return;

    // perspective() inside the card's own transform: no wrapper element needed.
    gsap.set(card, { transformPerspective: 900 });
    const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
    const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
    // Measured once per hover (the <li> is never tilted, so its box is a stable reference).
    let box: DOMRect | null = null;

    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      hovering.current = true;
      box = (card.parentElement ?? card).getBoundingClientRect();
      card.dataset.hover = "";
      setArmed(true);
      clip.current?.play().catch(() => {});
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !box) return;
      const px = clamp01((event.clientX - box.left) / box.width) - 0.5;
      const py = clamp01((event.clientY - box.top) / box.height) - 0.5;
      rotateX(-py * 2 * TILT_X); // pointer at the top edge → the top leans back
      rotateY(px * 2 * TILT_Y);
    };
    const leave = () => {
      hovering.current = false;
      box = null;
      delete card.dataset.hover;
      rotateX(0);
      rotateY(0);
      clip.current?.pause();
    };

    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    return () => {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(card);
      gsap.set(card, { clearProps: "transform" });
      delete card.dataset.hover;
    };
  }, [enabled]);

  // The <video> mounts on the first hover; start it if the pointer is still on the card.
  useEffect(() => {
    if (armed && hovering.current) clip.current?.play().catch(() => {});
  }, [armed]);

  return (
    <span ref={layer} className="hk-card-hover" data-ready={ready || undefined} aria-hidden="true">
      {armed && enabled && videoSrc ? (
        <video
          ref={clip}
          src={videoSrc}
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          onPlaying={() => setReady(true)}
        />
      ) : null}
      {armed && enabled && imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          onLoad={() => setReady(true)}
        />
      ) : null}
    </span>
  );
}
