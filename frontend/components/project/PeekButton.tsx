"use client";

import { Eye } from "lucide-react";

import { useMounted } from "@/components/chapters/shared/motion";
import { cn } from "@/lib/utils";

import { usePeek } from "./PeekProvider";

type Props = { projectId: number; title: string; className?: string };

/**
 * The "Peek" button of a grid card (spec §6.2): opens the quick preview of <PeekProvider>.
 * Only exists with JavaScript and inside a provider (no dead button in the no-JS HTML); it is
 * absolutely positioned on the cover, so appearing after hydration shifts nothing. It sits above
 * the card's stretched title link, and comes after that link in the tab order.
 */
export function PeekButton({ projectId, title, className }: Props) {
  const peek = usePeek();
  const mounted = useMounted();
  if (!peek || !mounted) return null;

  return (
    <button
      type="button"
      className={cn("hk-peek-btn hk-pixel", className)}
      aria-haspopup="dialog"
      data-cursor="PEEK"
      onClick={(event) => peek.open(projectId, event.currentTarget)}
    >
      <Eye aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      Peek<span className="sr-only">: {title}</span>
    </button>
  );
}
