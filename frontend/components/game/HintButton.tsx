"use client";

import { useMounted } from "@/components/chapters/shared/motion";
import { useHintStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  /** Stage key (a chapter key). */
  hintKey: string;
  /** Server copy of the hint (sections.hint); the registered text wins once the stage mounted. */
  text: string | null | undefined;
  className?: string;
};

/**
 * The small "?" next to a chapter title (spec §5.3): opens that stage's hint again, even if it
 * was seen. Invisible until hydrated — it does nothing without JavaScript — but its box is
 * always reserved, so it appearing never shifts the title.
 */
export function HintButton({ hintKey, text, className }: Props) {
  const mounted = useMounted();
  const registered = useHintStore((state) => state.texts[hintKey]);
  const show = useHintStore((state) => state.show);
  const hint = registered ?? text;
  if (!hint) return null;

  return (
    <button
      type="button"
      className={cn("hk-hint-btn hk-pixel", !mounted && "invisible", className)}
      aria-label="Show the hint for this stage"
      title="Show hint"
      onClick={() => show({ key: hintKey, text: hint, manual: true })}
    >
      ?
    </button>
  );
}
