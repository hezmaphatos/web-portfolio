import { Media } from "@/components/ui/Media";
import type { BossPhase } from "@/lib/battle";
import type { Boss } from "@/lib/types";

import { isInkLike, pixelBoss, type PixelFill } from "./pixelBoss";

/**
 * Sprite colours: the boss body tone (--boss: the project accent, or a light tint of it when the
 * accent is near-black) and the site tokens, never raw hex.
 */
const FILL: Record<PixelFill, string> = {
  body: "var(--boss)",
  shade: "color-mix(in srgb, var(--boss) 68%, var(--ink))",
  light: "color-mix(in srgb, var(--boss) 50%, var(--paper))",
  ink: "var(--ink)",
  paper: "var(--paper)",
  hot: "var(--hot)",
  lime: "var(--lime)",
};

type Props = {
  boss: Boss;
  /** Seeds the generative sprite (the project slug). */
  seed: string;
  accent: string;
  phase: BossPhase;
};

/**
 * The boss on the Arena stage (spec §6.4 step 1): the uploaded sprite (boss.sprite) or, when
 * there is none, a generative pixel boss drawn from the accent colour and tier (pixelBoss.ts).
 * Decorative — the Arena's name, HP bar and live region carry the meaning.
 *
 * The generative sprite is one crisp SVG rect per pixel ([data-px]), so the defeat can dissolve it
 * pixel by pixel; its CSS size is a whole number of screen pixels per sprite pixel (--px).
 */
export function BossSprite({ boss, seed, accent, phase }: Props) {
  if (boss.sprite?.mime.startsWith("image/")) {
    return (
      <div className="hk-boss-art" data-boss-art="image" aria-hidden="true">
        <Media
          media={boss.sprite}
          alt=""
          seed={seed}
          accent={accent}
          ratio={1}
          sizes="10rem"
          className="h-full w-full bg-transparent"
          imgClassName="object-contain [image-rendering:pixelated]"
        />
      </div>
    );
  }

  const art = pixelBoss(seed, boss.tier, accent, phase);
  return (
    <svg
      viewBox={`0 0 ${art.cols} ${art.rows}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className="hk-boss-art"
      data-boss-art="pixel"
      style={
        {
          "--cols": art.cols,
          "--rows": art.rows,
          "--boss": isInkLike(accent)
            ? "color-mix(in srgb, var(--accent) 40%, var(--paper))"
            : "var(--accent)",
        } as React.CSSProperties
      }
    >
      {art.pixels.map(({ x, y, fill }) => (
        // Inline style, not the fill attribute: presentation attributes don't resolve var().
        <rect
          key={`${x}-${y}`}
          data-px
          x={x}
          y={y}
          width={1}
          height={1}
          style={{ fill: FILL[fill] }}
        />
      ))}
    </svg>
  );
}
