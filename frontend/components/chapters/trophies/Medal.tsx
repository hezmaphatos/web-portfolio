import { cn } from "@/lib/utils";
import type { AwardPlacement } from "@/lib/types";

/** Medal disc colours (the palette has no yellow: lime is this site's "gold"). */
const DISC: Record<AwardPlacement, string> = {
  gold: "#C6F432",
  silver: "#F3EFE6",
  bronze: "#FF4B2B",
  finalist: "#3D5AFE",
  participant: "#F3EFE6",
};

const RANK: Partial<Record<AwardPlacement, string>> = { gold: "1", silver: "2", bronze: "3" };

/**
 * Ribbon + disc. Decorative: the placement is also written on the card. Shared by the trophy
 * cards (server) and the detail dialog (client), so it has no "use client" and no hooks.
 */
export function Medal({ placement, className }: { placement: AwardPlacement; className?: string }) {
  const rank = RANK[placement];
  return (
    <svg
      viewBox="0 0 64 84"
      aria-hidden="true"
      focusable="false"
      className={cn("overflow-visible drop-shadow-[3px_3px_0_var(--hot)]", className)}
    >
      <g stroke="#111111" strokeWidth="3" strokeLinejoin="round">
        <path d="M14 2 H30 L38 34 L24 38 Z" fill="#FF4B2B" />
        <path d="M50 2 H34 L26 34 L40 38 Z" fill="#3D5AFE" />
        <circle cx="32" cy="58" r="23" fill={DISC[placement]} strokeWidth="4" />
        <circle cx="32" cy="58" r="15" fill="none" strokeWidth="2" strokeDasharray="3 3" />
      </g>
      {rank ? (
        <text
          x="32"
          y="66"
          textAnchor="middle"
          fill="#111111"
          fontSize="22"
          fontWeight="700"
          className="hk-pixel"
        >
          {rank}
        </text>
      ) : null}
    </svg>
  );
}

/** Podium placements go on the top shelf; finalists and participants on the lower one. */
export const MEDALS: readonly AwardPlacement[] = ["gold", "silver", "bronze"];
