"use client";

import { createContext, useContext } from "react";

/** What a mounted Project Stage tells the modal around it (see StageModal). */
export type StageAnnouncement = {
  /** Id of the stage title: labels the dialog. */
  titleId: string;
  accent: string;
  /** The stage root (faded in when the modal swaps to another project). */
  root: HTMLElement | null;
  /** [data-stage-cover], the shared element. */
  cover: HTMLElement | null;
  /** Rect of the card that was clicked (rememberCardRect), or null: no hand-off. */
  from: DOMRect | null;
};

export type StageModalApi = {
  /** Called by the stage on every mount / re-show; opens the modal or swaps its content. */
  announce: (stage: StageAnnouncement) => void;
};

export const StageModalContext = createContext<StageModalApi | null>(null);

/** The modal shell around this stage, or null on the full page. */
export const useStageModal = () => useContext(StageModalContext);
