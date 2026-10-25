"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { useStill } from "@/components/ui/useStill";

import { useToastStore, type Toast } from "./toast";

/**
 * Renders the toasts (components/game/toast/toast.ts), mounted once in the site layout.
 * The list itself is the polite live region: it is always in the DOM (so the first toast is
 * announced too) and every new toast is an added node, which screen readers read once.
 * `data-inert-keep`: stays live while a dialog makes the rest of the page inert.
 * Toasts never take the pointer or the focus; each one leaves on its own after `duration`.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const still = useStill();

  return (
    <div className="hk-toast-host" data-inert-keep>
      <div
        role="status"
        aria-live="polite"
        aria-relevant="additions text"
        className="hk-toast-list"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((item) => (
            <ToastItem key={item.id} toast={item} still={still} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({ toast, still }: { toast: Toast; still: boolean }) {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <motion.div
      layout={!still}
      className="hk-toast"
      // Lite / reduced motion: a plain fade. Otherwise it slides in from the right edge with a
      // short spring, and the ones below shift up (layout = transform) when one leaves.
      initial={still ? { opacity: 0 } : { opacity: 0, x: 48 }}
      animate={
        still
          ? { opacity: 1, transition: { duration: 0.15 } }
          : { opacity: 1, x: 0, transition: { type: "spring", stiffness: 520, damping: 34 } }
      }
      exit={
        still
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { opacity: 0, x: 48, transition: { duration: 0.18, ease: "easeIn" } }
      }
    >
      {toast.icon ? (
        <span aria-hidden="true" className="hk-toast-icon">
          {toast.icon}
        </span>
      ) : null}
      <span className="hk-toast-text">{toast.message}</span>
    </motion.div>
  );
}
