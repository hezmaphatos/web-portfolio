import type { CSSProperties } from "react";

/**
 * Hackker, the pixel avatar: generated SVG pixel art (no image files), two walk frames.
 * Each frame is a <g data-frame="0|1">; animations swap frames by toggling their opacity
 * (frame 1 starts hidden), so walking costs no layout and no React renders.
 * Decorative only: always aria-hidden.
 */

// 10 × 12 grid. k ink · h hot (hoodie) · p paper (face, hands) · l lime (visor) · v volt (jeans)
const BODY = [
  "...kkkk...",
  "..khhhhk..",
  ".khhhhhhk.",
  ".khpppphk.",
  ".khllllhk.",
  ".khpppphk.",
  "..kkhhkk..",
  ".khhhhhhk.",
  "kphhhhhhpk",
  ".khhhhhhk.",
];

const FRAMES = [
  [...BODY, ".kvvkkvvk.", "kkk....kkk"], // stride
  [...BODY, "..kvvvvk..", "...kkkk..."], // legs passing
];

const FILL: Record<string, string> = {
  k: "var(--ink)",
  h: "var(--hot)",
  p: "var(--paper)",
  l: "var(--lime)",
  v: "var(--volt)",
};

export const AVATAR_COLS = 10;
export const AVATAR_ROWS = 12;

/** One <rect> per horizontal run of the same colour (keeps the DOM small). */
function runs(rows: string[]) {
  const rects: { x: number; y: number; w: number; c: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== ".") rects.push({ x, y, w: end - x, c });
      x = end;
    }
  });
  return rects;
}

const FRAME_RECTS = FRAMES.map(runs);

type Props = {
  /** Size of one pixel in CSS px. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

export function PixelAvatar({ scale = 3, className, style }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={AVATAR_COLS * scale}
      height={AVATAR_ROWS * scale}
      viewBox={`0 0 ${AVATAR_COLS} ${AVATAR_ROWS}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {FRAME_RECTS.map((rects, frame) => (
        <g key={frame} data-frame={frame} style={frame === 0 ? undefined : { opacity: 0 }}>
          {rects.map((r) => (
            // Colour via style (not the fill attribute) so the CSS variables always resolve.
            <rect
              key={`${r.x}-${r.y}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={1}
              style={{ fill: FILL[r.c] }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/**
 * Returns a function that shows walk frame 0 or 1 of the avatar(s) inside `root`.
 * Frames are looked up once; calling it with the current frame does nothing.
 */
export function avatarFrameSetter(root: Element | null): (frame: number) => void {
  const groups = root ? Array.from(root.querySelectorAll<SVGGElement>("[data-frame]")) : [];
  let current = 0;
  return (frame) => {
    if (frame === current) return;
    current = frame;
    for (const g of groups) g.style.opacity = g.dataset.frame === String(frame) ? "1" : "0";
  };
}
