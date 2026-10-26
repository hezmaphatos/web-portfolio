"use client";

import { AnimatePresence } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useMounted } from "@/components/chapters/shared/motion";
import { completeStageHint } from "@/components/game/useStageHint";
import { lockScroll } from "@/components/providers/SmoothScroll";
import { inertOutside, trapTab } from "@/components/ui/focus";
import { useStill } from "@/components/ui/useStill";
import { useHintStore } from "@/lib/store";
import type { ProjectSummary } from "@/lib/types";

import { PeekDialog } from "./PeekDialog";

/** What the quick preview shows: a slice of the project summary (no long content). */
export type PeekProject = Pick<
  ProjectSummary,
  | "id"
  | "slug"
  | "title"
  | "tagline"
  | "summary"
  | "category"
  | "kind"
  | "year_start"
  | "year_end"
  | "accent_color"
  | "cover"
  | "peek"
  | "skills"
  | "boss"
>;

type PeekApi = { open: (projectId: number, trigger: HTMLElement) => void };

const PeekContext = createContext<PeekApi | null>(null);

/** For <PeekButton>: null outside a <PeekProvider> (the button then renders nothing). */
export function usePeek(): PeekApi | null {
  return useContext(PeekContext);
}

type Open = { project: PeekProject; trigger: HTMLElement };

/**
 * Quick preview ("Peek", spec §6.2) for the project grid: a light dialog with the project's
 * `peek` images as a mini gallery, title, tagline, tech and an "Open level" link — without
 * leaving the page. This provider owns the modal behaviour (like the trophy dialog): page scroll
 * locked, everything else inert, Tab trapped, Esc / ✕ / backdrop close, focus back on the Peek
 * button. Following "Open level" closes the peek without returning focus: the Project Stage
 * (intercepted modal) takes over.
 */
export function PeekProvider({
  projects,
  children,
}: {
  projects: PeekProject[];
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const navigating = useRef(false);
  const [open, setOpen] = useState<Open | null>(null);
  const still = useStill();
  const mounted = useMounted();

  const openPeek = useCallback(
    (projectId: number, trigger: HTMLElement) => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) return;
      navigating.current = false;
      completeStageHint("projects");
      useHintStore.getState().dismiss(); // nothing floats over the dialog
      setOpen({ project, trigger });
    },
    [projects],
  );
  const close = useCallback(() => setOpen(null), []);
  const leave = useCallback(() => {
    navigating.current = true;
    setOpen(null);
  }, []);
  const api = useMemo(() => ({ open: openPeek }), [openPeek]);

  // Modal behaviour while a peek is open. The cleanup runs as soon as it closes (the panel may
  // still be fading out), so the page is usable and focus is back on the button at once.
  const trigger = open?.trigger ?? null;
  useEffect(() => {
    const host = layer.current;
    if (!trigger || !host) return;
    const releaseScroll = lockScroll();
    const restoreInert = inertOutside([host]);
    const root = document.documentElement;
    root.dataset.overlay = "dialog"; // tints the scrollbar gutter + hides the hint card (CSS)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(null);
        return;
      }
      const dialog = host.querySelector<HTMLElement>("[role='dialog']");
      if (dialog) trapTab(event, dialog);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (root.dataset.overlay === "dialog") delete root.dataset.overlay;
      restoreInert();
      releaseScroll();
      if (!navigating.current && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  return (
    <PeekContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div ref={layer} className="hk-modal-layer">
              <AnimatePresence>
                {open ? (
                  <PeekDialog
                    key={open.project.id}
                    project={open.project}
                    still={still}
                    onClose={close}
                    onNavigate={leave}
                  />
                ) : null}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </PeekContext.Provider>
  );
}
