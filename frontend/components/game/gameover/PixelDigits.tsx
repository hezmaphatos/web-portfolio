/**
 * The digits 9 → 0 as 5×7 pixel art in one tall SVG strip (no font, crisp at any size).
 * The GAME OVER countdown shows one cell at a time and steps the strip up with a CSS
 * `steps()` animation, so it ticks with and without JavaScript. Server-safe (no hooks).
 */

const GLYPHS: Record<number, readonly string[]> = {
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  3: ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
};

/** Rows per cell: 7 rows of glyph + 1 empty row, so neighbouring digits never touch. */
export const DIGIT_CELL = 8;
const ORDER = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

type Run = { x: number; y: number; w: number };

/** Horizontal runs of "#" (one <rect> per run instead of one per pixel). */
function runs(): Run[] {
  const out: Run[] = [];
  ORDER.forEach((digit, cell) => {
    GLYPHS[digit]?.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "#") {
          x++;
          continue;
        }
        const start = x;
        while (row[x] === "#") x++;
        out.push({ x: start, y: cell * DIGIT_CELL + y, w: x - start });
      }
    });
  });
  return out;
}

const RUNS = runs();

export function PixelDigits({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 5 ${DIGIT_CELL * ORDER.length}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {RUNS.map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
