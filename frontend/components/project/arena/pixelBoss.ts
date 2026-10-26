import type { BossPhase } from "@/lib/battle";
import type { BossTier } from "@/lib/types";

/*
 * Generative pixel boss (spec §6.4 Arena, docs/API.md: "sprite null → the frontend draws a
 * generative pixel boss from accent_color + tier"). Pure and deterministic: the same seed, tier,
 * accent and phase always give the same sprite, on the server and in the browser, so it renders in
 * the static HTML and never mismatches on hydration.
 *
 * Every tier has its own silhouette (minion = slime, regular = horned beast, final = crowned
 * colossus); the seed (project slug) varies the details (horns, eyes, mouth, belly pattern). The
 * `final` tier has three visual phases (§6.4 step 4): cracked + angry at 66 % HP, broken open with
 * an exposed core at 33 %. Bodies are mirrored, damage is not — it reads as damage.
 */

export type PixelFill = "ink" | "body" | "shade" | "light" | "paper" | "hot" | "lime";

export type Pixel = Readonly<{ x: number; y: number; fill: PixelFill }>;

export type PixelBossArt = Readonly<{ cols: number; rows: number; pixels: readonly Pixel[] }>;

/** Sprite size per tier (odd widths: the body mirrors around a centre column). */
const SIZE: Record<BossTier, readonly [cols: number, rows: number]> = {
  minion: [13, 11],
  regular: [15, 15],
  final: [19, 19],
};

/** FNV-1a: a stable 32-bit hash of the seed string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded PRNG, 0 ≤ n < 1. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Whether two colours are close enough that one would vanish on the other. */
function near(a: string, b: string): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return false;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110;
}

/**
 * Whether an accent is so dark that an accent-coloured body would melt into its ink outline:
 * such bosses are drawn in a lighter tint of the accent (see BossSprite).
 */
export function isInkLike(accent: string): boolean {
  return near(accent, "#111111");
}

type Grid = (PixelFill | null)[][];

class Canvas {
  readonly cols: number;
  readonly rows: number;
  readonly grid: Grid;
  readonly cx: number;
  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array<PixelFill | null>(cols).fill(null));
    this.cx = (cols - 1) / 2;
  }

  /** Paints one cell (ignored outside the 1-cell margin kept free for the outline). */
  set(x: number, y: number, fill: PixelFill | null): void {
    if (x < 1 || y < 1 || x > this.cols - 2 || y > this.rows - 2) return;
    this.grid[y][x] = fill;
  }

  /** Paints a cell and its mirror image around the centre column. */
  mirror(dx: number, y: number, fill: PixelFill | null): void {
    this.set(this.cx - dx, y, fill);
    this.set(this.cx + dx, y, fill);
  }

  /** A body row: the centre ± `half` cells. */
  row(y: number, half: number, fill: PixelFill = "body"): void {
    for (let dx = 0; dx <= half; dx++) this.mirror(dx, y, fill);
  }

  /** Only repaints cells that are already filled (patterns stay inside the silhouette). */
  over(x: number, y: number, fill: PixelFill): void {
    if (this.grid[y]?.[x]) this.set(x, y, fill);
  }

  /** Ink outline around everything filled (4-neighbourhood: clean pixel-art corners). */
  outline(): void {
    const filled = this.grid.map((row) => row.map((cell) => cell !== null));
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (filled[y][x]) continue;
        const touches =
          filled[y - 1]?.[x] || filled[y + 1]?.[x] || filled[y][x - 1] || filled[y][x + 1];
        if (touches) this.grid[y][x] = "ink";
      }
    }
  }

  pixels(): Pixel[] {
    const out: Pixel[] = [];
    this.grid.forEach((row, y) =>
      row.forEach((fill, x) => {
        if (fill) out.push({ x, y, fill });
      }),
    );
    return out;
  }
}

/** An eye: paper with an ink pupil on the inner side (dx > 0 = right eye). */
function eye(c: Canvas, dx: number, y: number, tall: boolean, glow: PixelFill | null): void {
  const white: PixelFill = glow ?? "paper";
  c.mirror(dx, y, white);
  c.mirror(dx + 1, y, white);
  if (tall) {
    c.mirror(dx, y + 1, white);
    c.mirror(dx + 1, y + 1, white);
  }
  if (!glow) c.mirror(dx, tall ? y + 1 : y, "ink");
}

function slime(c: Canvas, rand: () => number): void {
  const { cx } = c;
  const top = rand() < 0.5 ? 1 : 2;
  c.row(1, top);
  c.row(2, 3);
  c.row(3, rand() < 0.5 ? 4 : 5);
  for (let y = 4; y <= 8; y++) c.row(y, 5);
  // Drips on the bottom row, mirrored, at least one.
  const drips = [1, 3, 5].filter(() => rand() < 0.6);
  for (const dx of drips.length ? drips : [3]) c.mirror(dx, 9, "body");
  for (let dx = 0; dx <= 5; dx++) c.mirror(dx, 8, "shade");
  // Shine on the dome (not mirrored: it gives the blob volume).
  c.over(cx - 2, 2, "light");
  c.over(cx - 3, 3, "light");
  c.over(cx - 4, 4, "light");
  const wide = rand() < 0.5;
  eye(c, wide ? 2 : 1, 4, wide, null);
  // A small grin.
  c.mirror(2, 6, "ink");
  c.mirror(1, 7, "ink");
  c.mirror(0, 7, "ink");
}

function beast(c: Canvas, rand: () => number, accent: string): void {
  const { cx } = c;
  const crest: PixelFill = near(accent, "#f3efe6") ? "lime" : "paper";
  const horns = Math.floor(rand() * 3);
  if (horns === 0) {
    // Curved horns.
    c.mirror(5, 1, crest);
    c.mirror(5, 2, crest);
    c.mirror(4, 2, crest);
  } else if (horns === 1) {
    // Antennae with glowing tips.
    c.mirror(3, 1, near(accent, "#c6f432") ? "hot" : "lime");
    c.mirror(3, 2, "ink");
  } else {
    // Pointed ears.
    c.mirror(5, 2, "body");
    c.mirror(4, 2, "body");
    c.mirror(5, 1, "body");
  }
  c.row(3, 4);
  for (let y = 4; y <= 11; y++) c.row(y, 5);
  // Arms.
  for (let y = 7; y <= 10; y++) c.mirror(6, y, "body");
  c.mirror(6, 10, "shade");
  // Feet.
  for (let y = 12; y <= 13; y++) for (let dx = 2; dx <= 4; dx++) c.mirror(dx, y, "body");
  for (let dx = 2; dx <= 4; dx++) c.mirror(dx, 13, "shade");
  // Belly.
  for (let dx = 0; dx <= 5; dx++) c.mirror(dx, 11, "shade");
  if (rand() < 0.5) for (let dx = 0; dx <= 1; dx++) c.mirror(dx, 10, "light");
  // Forehead mark.
  const mark = Math.floor(rand() * 3);
  if (mark === 0) c.set(cx, 4, "ink");
  else if (mark === 1) c.mirror(1, 4, "light");
  eye(c, rand() < 0.5 ? 1 : 2, 5, true, null);
  // Fanged mouth.
  for (let dx = 0; dx <= 3; dx++) c.mirror(dx, 8, "ink");
  c.mirror(rand() < 0.5 ? 1 : 2, 8, "paper");
  for (let dx = 0; dx <= 2; dx++) c.mirror(dx, 9, "ink");
}

function colossus(c: Canvas, rand: () => number, accent: string, phase: BossPhase): void {
  const { cx } = c;
  const gold: PixelFill = near(accent, "#c6f432") ? "hot" : "lime";
  const glow: PixelFill = near(accent, "#ff4b2b") ? "lime" : "hot";

  // Crown (rows 1–2) on an ink band (row 3) that keeps it apart from any accent. It takes damage.
  if (phase === 1) {
    for (const dx of [0, 3]) c.mirror(dx, 1, gold);
    c.row(2, 3, gold);
    c.row(3, 3, "ink");
  } else if (phase === 2) {
    c.mirror(0, 1, gold);
    c.set(cx - 3, 1, gold);
    c.row(2, 3, gold);
    c.set(cx + 2, 2, null); // a dent
    c.row(3, 3, "ink");
  } else {
    for (let x = cx - 3; x <= cx; x++) {
      c.set(x, 2, gold); // half a crown left
      c.set(x, 3, "ink");
    }
  }
  // Head (11 wide), shoulders, torso, hanging arms with fists, legs.
  for (let y = 4; y <= 8; y++) c.row(y, 5);
  c.row(9, 8);
  for (let y = 10; y <= 13; y++) {
    c.row(y, 6);
    c.mirror(8, y, "body");
  }
  c.mirror(8, 13, "shade");
  c.mirror(8, 14, "shade");
  c.mirror(7, 14, "shade");
  for (let dx = 0; dx <= 6; dx++) c.mirror(dx, 13, "shade"); // belt
  for (let y = 14; y <= 17; y++) for (let dx = 2; dx <= 4; dx++) c.mirror(dx, y, "body");
  for (let dx = 2; dx <= 4; dx++) c.mirror(dx, 17, "shade");
  // Chest plate pattern (seeded).
  const plate = Math.floor(rand() * 3);
  if (plate === 0) {
    // Stacked pages.
    for (let dx = 0; dx <= 4; dx++) {
      c.mirror(dx, 10, "light");
      c.mirror(dx, 12, "light");
    }
  } else if (plate === 1) {
    for (const dx of [2, 5]) {
      c.mirror(dx, 10, "ink"); // rivets
      c.mirror(dx, 12, "ink");
    }
  } else {
    for (let y = 10; y <= 12; y++) c.mirror(3, y, "light"); // two straps
  }
  // Shine on the head (not mirrored: it gives the head volume).
  c.over(cx - 4, 4, "light");
  c.over(cx - 5, 5, "light");

  // Face per phase: calm, then glowing angry eyes, then a roar.
  eye(c, 2, 5, true, phase === 1 ? null : phase === 2 ? glow : gold);
  if (phase >= 2) {
    // Angry brows: low on the inside.
    c.mirror(1, 5, "ink");
    c.mirror(2, 4, "ink");
    c.mirror(3, 4, "ink");
  }
  for (let dx = 0; dx <= 2; dx++) c.mirror(dx, 8, "ink");
  c.mirror(1, 8, "paper"); // teeth
  if (phase === 3) for (let dx = 0; dx <= 1; dx++) c.mirror(dx, 7, "ink"); // the jaw drops

  if (phase >= 2) {
    // Cracks across the torso and a cheek, seeded but never mirrored.
    const sx = cx - 6 + Math.floor(rand() * 2);
    for (let i = 0; i < 4; i++) c.over(sx + i, 10 + i, "ink");
    c.over(cx + 5, 6, "ink");
    c.over(cx + 4, 7, "ink");
  }
  if (phase === 3) {
    // Chunks knocked off: the left shoulder, the right fist.
    for (let y = 9; y <= 10; y++) for (let x = cx - 8; x <= cx - 6; x++) c.set(x, y, null);
    for (let y = 12; y <= 14; y++) for (let x = cx + 7; x <= cx + 8; x++) c.set(x, y, null);
    // Exposed core: a glowing diamond in the chest.
    c.set(cx, 9, "ink");
    c.mirror(1, 10, "ink");
    c.set(cx, 10, gold);
    c.mirror(2, 11, "ink");
    c.mirror(1, 11, glow);
    c.set(cx, 11, gold);
    c.mirror(1, 12, "ink");
    c.set(cx, 12, glow);
    c.set(cx, 13, "ink");
  }
}

/**
 * The sprite of a boss without uploaded art. `seed` = the project slug (or any stable string),
 * `accent` = the project accent (picks crown/eye colours that stay visible on it). Phases only
 * matter for the `final` tier; other tiers always draw phase 1.
 */
export function pixelBoss(
  seed: string,
  tier: BossTier,
  accent: string,
  phase: BossPhase = 1,
): PixelBossArt {
  const [cols, rows] = SIZE[tier];
  const c = new Canvas(cols, rows);
  // The phase never feeds the PRNG: the same boss keeps its features in every phase.
  const rand = prng(hash(`${seed}|${tier}|${accent.toLowerCase()}`));
  if (tier === "minion") slime(c, rand);
  else if (tier === "regular") beast(c, rand, accent);
  else colossus(c, rand, accent, phase);
  c.outline();
  return { cols, rows, pixels: c.pixels() };
}
