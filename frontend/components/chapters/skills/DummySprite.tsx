/** One pixel run: x, y, width, height (in sprite pixels) and a fill. */
type Run = readonly [x: number, y: number, w: number, h: number, fill: string];

const INK = "var(--ink)";
const SACK = "var(--paper)";
const HOT = "var(--hot)";
const LIME = "var(--lime)";

/*
 * A straw training dummy on a post, 20 × 28 sprite pixels: stitched sack head, rope tie, sack
 * body with a target on the chest, stubby arms, post and base. Drawn as rects with crisp edges,
 * so it stays pixel-sharp at any size.
 */
const RUNS: readonly Run[] = [
  // Head
  [7, 1, 6, 1, INK],
  [6, 2, 1, 5, INK],
  [13, 2, 1, 5, INK],
  [7, 2, 6, 5, SACK],
  [7, 7, 6, 1, INK],
  [8, 3, 1, 1, INK], // X eyes
  [9, 4, 1, 1, INK],
  [8, 5, 1, 1, INK],
  [11, 3, 1, 1, INK],
  [10, 4, 1, 1, INK],
  [11, 5, 1, 1, INK],
  [9, 6, 2, 1, HOT], // stitched mouth
  // Rope tie
  [8, 8, 4, 1, HOT],
  // Arms
  [1, 11, 4, 1, INK],
  [1, 12, 1, 1, INK],
  [2, 12, 3, 1, SACK],
  [1, 13, 4, 1, INK],
  [15, 11, 4, 1, INK],
  [18, 12, 1, 1, INK],
  [15, 12, 3, 1, SACK],
  [15, 13, 4, 1, INK],
  // Body
  [6, 9, 8, 1, INK],
  [5, 10, 1, 9, INK],
  [14, 10, 1, 9, INK],
  [6, 10, 8, 9, SACK],
  [6, 19, 8, 1, INK],
  // Target
  [7, 11, 6, 6, HOT],
  [8, 12, 4, 4, SACK],
  [9, 13, 2, 2, HOT],
  // Patch
  [12, 17, 1, 1, LIME],
  [7, 18, 2, 1, INK],
  // Post + base
  [9, 20, 2, 6, INK],
  [6, 26, 8, 1, INK],
  [4, 27, 12, 1, INK],
];

/** Pixel-art Training Dummy (decorative: the panel's text and HP bar carry the meaning). */
export function DummySprite({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 28"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {RUNS.map(([x, y, w, h, fill], i) => (
        // Inline style, not the fill attribute: presentation attributes don't resolve var().
        <rect key={i} x={x} y={y} width={w} height={h} style={{ fill }} />
      ))}
    </svg>
  );
}
