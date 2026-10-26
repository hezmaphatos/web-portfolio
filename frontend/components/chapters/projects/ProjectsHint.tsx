"use client";

import { useRef } from "react";

import { useStageHint } from "@/components/game/useStageHint";

/**
 * Registers the LEVEL SELECT stage hint (spec §5.3: "Every project is a boss. Open one…").
 * Renders an empty marker inside the chapter; useStageHint measures the closest
 * [data-chapter]. The hint completes when a card is opened (handoff.ts) or peeked.
 */
export function ProjectsHint({ hint }: { hint: string | null }) {
  const marker = useRef<HTMLSpanElement>(null);
  useStageHint("projects", hint, marker);
  return <span ref={marker} hidden />;
}
