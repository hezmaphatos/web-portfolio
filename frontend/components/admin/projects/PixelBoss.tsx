import type { BossTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Admin stand-in for the generative pixel boss (spec §7 Boss tab: "kosong = pixel boss generatif
 * dari accent_color + tier"). Deterministic: the same seed, colour and tier always draw the same
 * mirrored sprite. Bigger tiers get a bigger grid; the final boss wears a crown.
 */

type Cell = "body" | "shade" | "light" | "eye" | "mouth" | "crown" | "outline" | null;

const GRID: Record<BossTier, { width: number; height: number }> = {
  minion: { width: 9, height: 8 },
  regular: { width: 11, height: 10 },
  final: { width: 13, height: 12 },
};

const INK = "#111111";
const EYE = "#FFFFFF";
const CROWN = "#C6F432";

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: tiny seeded PRNG, enough for a sprite. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const rgb = parseHex(hex) ?? [255, 75, 43];
  const out = rgb.map((channel, i) => Math.round(channel + (target[i] - channel) * amount));
  return `#${out.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** The sprite as a grid of cells (1-cell transparent margin for the outline). */
export function pixelBossCells(seed: string, tier: BossTier): Cell[][] {
  const { width, height } = GRID[tier];
  const next = random(hashString(`${seed}|${tier}`));
  const center = (width - 1) / 2;
  const top = tier === "final" ? 1 : 0; // row 0 holds the crown
  const rows = height - top;

  const body: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  for (let r = 0; r < rows; r++) {
    const dy = Math.abs(r - rows * 0.5) / (rows * 0.5);
    for (let c = 0; c <= center; c++) {
      const dx = (center - c) / center;
      const chance = 0.95 - 0.55 * dx * dx - 0.45 * dy * dy;
      const filled = c === center ? r > 0 && r < rows - 1 : next() < chance;
      body[r + top][c] = filled;
      body[r + top][width - 1 - c] = filled;
    }
  }

  const cells: Cell[][] = body.map((row) => row.map((filled) => (filled ? "body" : null)));
  const set = (r: number, c: number, cell: Cell) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return;
    cells[r][c] = cell;
    cells[r][width - 1 - c] = cell;
  };

  // Face: eyes, the pixels around them and a mouth.
  const eyeRow = top + Math.floor(rows * 0.38);
  const eyeCol = center - (tier === "minion" ? 1 : 2);
  for (let r = eyeRow - 1; r <= eyeRow + 2; r++) {
    for (let c = eyeCol - 1; c <= center; c++) if (!cells[r]?.[c]) set(r, c, "body");
  }
  set(eyeRow, eyeCol, "eye");
  const mouthRow = eyeRow + 2;
  for (let c = tier === "minion" ? center : center - 1; c <= center; c++) set(mouthRow, c, "mouth");

  // Feet (regular / final), crown (final).
  if (tier !== "minion") {
    set(height - 1, center - 2, "body");
    set(height - 1, center - 3, "body");
  }
  if (tier === "final") {
    for (const c of [center, center - 2, center - 4]) set(0, c, "crown");
    for (let c = center - 4; c <= center; c++) if (!cells[1][c]) set(1, c, "crown");
  }

  // Shading: lit top edges, darker lower third.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (cells[r][c] !== "body") continue;
      if (r === 0 || cells[r - 1][c] === null) cells[r][c] = "light";
      else if (r >= top + rows * 0.68) cells[r][c] = "shade";
    }
  }

  // Outline: empty cells touching the sprite, on a grid with a 1-cell margin.
  const padded: Cell[][] = Array.from({ length: height + 2 }, (_, r) =>
    Array.from({ length: width + 2 }, (_, c) => cells[r - 1]?.[c - 1] ?? null),
  );
  return padded.map((row, r) =>
    row.map((cell, c) => {
      if (cell) return cell;
      const touches = [
        padded[r - 1]?.[c],
        padded[r + 1]?.[c],
        padded[r]?.[c - 1],
        padded[r]?.[c + 1],
      ].some((neighbour) => neighbour && neighbour !== "outline");
      return touches ? "outline" : null;
    }),
  );
}

type PixelBossProps = {
  /** Anything stable per project (slug or title). */
  seed: string;
  /** `accent_color`, `#RRGGBB`. */
  color: string;
  tier: BossTier;
  /** Accessible name; omit to make the sprite decorative. */
  label?: string;
  className?: string;
};

export function PixelBoss({ seed, color, tier, label, className }: PixelBossProps) {
  const cells = pixelBossCells(seed || "boss", tier);
  const accent = parseHex(color) ? color : "#FF4B2B";
  const fill: Record<Exclude<Cell, null>, string> = {
    body: accent,
    light: mix(accent, [255, 255, 255], 0.35),
    shade: mix(accent, [0, 0, 0], 0.3),
    eye: EYE,
    mouth: INK,
    crown: CROWN,
    outline: INK,
  };
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      className={cn("block", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {cells.flatMap((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fill[cell]} />
          ) : null,
        ),
      )}
      {/* Pupils: a smaller ink square inside each eye. */}
      {cells.flatMap((row, r) =>
        row.map((cell, c) =>
          cell === "eye" ? (
            <rect
              key={`pupil-${r}-${c}`}
              x={c < cols / 2 ? c + 0.5 : c}
              y={r + 0.4}
              width={0.5}
              height={0.6}
              fill={INK}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
