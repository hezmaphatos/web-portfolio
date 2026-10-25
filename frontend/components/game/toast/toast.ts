"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

/*
 * The site's toast system (phase 5): small HUD-style notes in the top-right corner, announced
 * politely to screen readers. Used for "Email copied" now and for badge unlocks in phase 7.
 *
 *   import { toast } from "@/components/game/toast/toast";
 *   toast("Email copied", { icon: <Check /> });
 *
 * <ToastHost> (mounted once in the site layout) renders them. Session state only, not persisted.
 */

export type ToastOptions = {
  /** Small icon in the lime square on the left (a lucide icon, a pixel glyph …). Decorative. */
  icon?: ReactNode;
  /** How long it stays, in ms (default 3200). */
  duration?: number;
};

export type Toast = {
  id: number;
  message: string;
  icon: ReactNode;
  duration: number;
};

/** At most this many on screen; the oldest one leaves first. */
const MAX_TOASTS = 3;
const DEFAULT_DURATION = 3200;

type ToastState = {
  toasts: Toast[];
  push: (toast: Toast) => void;
  dismiss: (id: number) => void;
};

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast) => set({ toasts: [...get().toasts, toast].slice(-MAX_TOASTS) }),
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

let nextId = 1;

/** Shows a toast; returns its id (for dismissToast). Safe to call from any client code. */
export function toast(message: string, options: ToastOptions = {}): number {
  const id = nextId++;
  useToastStore.getState().push({
    id,
    message,
    icon: options.icon ?? null,
    duration: options.duration ?? DEFAULT_DURATION,
  });
  return id;
}

export function dismissToast(id: number): void {
  useToastStore.getState().dismiss(id);
}
