"use client";

import { useEffect, useState } from "react";

import type { SectionKey } from "@/lib/types";

export type ChapterSection = { key: SectionKey; el: HTMLElement };

export type PageChapters = {
  /** The visible Home chapters in document order (empty on every other page). */
  sections: ChapterSection[];
  /** location.pathname when the list was taken ("" on the server / before mount). */
  path: string;
};

const EMPTY: PageChapters = { sections: [], path: "" };

/** display:none (a hidden Activity route) leaves an element without client rects. */
const isRendered = (el: HTMLElement) => el.getClientRects().length > 0;

/**
 * The `section[data-chapter]` elements of the page on screen. The game chrome lives in the (site)
 * layout and survives client navigations, so the list must follow them. With Cache Components,
 * Next.js does not unmount the previous route: it keeps it in the DOM inside React <Activity>
 * with `style="display: none !important"` on its top-level nodes (the chapters). So we watch
 * <main>'s children (a new route inserted) *and* their style attribute (a preserved route shown
 * or hidden again — back/forward), and skip hidden sections.
 * DOM-based on purpose: usePathname() would need a Suspense boundary under Cache Components on
 * the dynamic /projects/[slug] route.
 */
export function useChapterSections(): PageChapters {
  const [state, setState] = useState<PageChapters>(EMPTY);

  useEffect(() => {
    const main = document.getElementById("main");
    let frame = 0;

    const scan = () => {
      frame = 0;
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-chapter]"))
        .filter(isRendered)
        .map((el) => ({ key: el.dataset.chapter as SectionKey, el }));
      const path = window.location.pathname;
      setState((prev) =>
        prev.path === path &&
        prev.sections.length === sections.length &&
        prev.sections.every((s, i) => s.el === sections[i].el)
          ? prev
          : { sections, path },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };

    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) watch();
      schedule();
    });
    // Direct children only (not the subtree): animations write inline styles deep inside the
    // chapters every frame, and none of that matters here.
    function watch() {
      if (!main) return;
      observer.disconnect();
      observer.observe(main, { childList: true });
      for (const child of Array.from(main.children)) {
        observer.observe(child, { attributes: true, attributeFilter: ["style", "hidden"] });
      }
    }

    scan();
    watch();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
