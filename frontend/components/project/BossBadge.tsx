import { BossHp } from "@/components/chapters/projects/BossHp";
import { cn } from "@/lib/utils";
import type { Boss, BossTier } from "@/lib/types";

/** 7-column pixel sprites, one per tier ("#" = filled). Drawn as crisp SVG rects in currentColor. */
const SPRITES: Record<BossTier, string[]> = {
  // A slime.
  minion: ["..###..", ".#####.", "##.#.##", "#######", "#######", ".#.#.#."],
  // A horned mask.
  regular: ["#.....#", "##...##", ".#####.", "##.#.##", "#######", ".#.#.#."],
  // A crowned skull.
  final: ["#..#..#", "##.#.##", "#######", "#.#.#.#", "#######", ".#.#.#."],
};

const TIER_TEXT: Record<BossTier, string> = {
  minion: "Minion",
  regular: "Boss",
  final: "Final boss",
};

/** Each tier has its own sticker colour; text colours keep AA contrast on it. */
const TIER_STYLE: Record<BossTier, string> = {
  minion: "bg-lime text-ink",
  regular: "bg-volt text-paper",
  final: "bg-hot text-ink",
};

export function TierIcon({ tier, className }: { tier: BossTier; className?: string }) {
  const rows = SPRITES[tier];
  return (
    <svg
      viewBox={`0 0 7 ${rows.length}`}
      className={cn("h-[1em] w-auto shrink-0", className)}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "#" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

type Props = {
  boss: Boss;
  /** Also print the boss name ("The Paper Colossus"). */
  withName?: boolean;
  size?: "sm" | "md";
  /**
   * Pass the project id to follow the save cookie: once the boss is defeated the HP is struck
   * through (same width, no layout shift). Without it the sticker is fully static.
   */
  projectId?: number;
  className?: string;
};

/**
 * Boss sticker for cards and the Project Stage: tier sprite, tier, HP. Renders nothing for
 * projects without a boss (spec §6.4: those are fully open and have no Arena).
 */
export function BossBadge({ boss, withName = false, size = "md", projectId, className }: Props) {
  if (!boss.enabled) return null;

  return (
    <p
      className={cn(
        "hk-pixel border-ink inline-flex items-center gap-2 border-2 leading-none shadow-[3px_3px_0_var(--ink)]",
        size === "sm" ? "px-2 py-1.5 text-[0.6875rem]" : "px-3 py-2 text-xs",
        TIER_STYLE[boss.tier],
        className,
      )}
      data-boss-tier={boss.tier}
    >
      <TierIcon tier={boss.tier} className={size === "sm" ? "text-sm" : "text-base"} />
      <span>
        {withName ? (
          <>
            <span className="sr-only">Boss: </span>
            {boss.name}
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
          </>
        ) : null}
        {TIER_TEXT[boss.tier]}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        {projectId !== undefined ? (
          <BossHp hp={boss.hp} projectId={projectId} />
        ) : (
          <span className="hk-mono font-bold tracking-normal whitespace-nowrap">HP {boss.hp}</span>
        )}
      </span>
    </p>
  );
}
