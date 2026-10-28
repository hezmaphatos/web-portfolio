import { ICON_SIZE } from "@/lib/badges";

type Run = { x: number; y: number; w: number; light: boolean };

/** Rows of `#` / `o` / `.` → horizontal runs (one <rect> per run instead of one per pixel). */
function runs(rows: readonly string[], silhouette: boolean): Run[] {
  const out: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      if (cell === ".") {
        x += 1;
        continue;
      }
      const light = !silhouette && cell === "o";
      let w = 1;
      while (x + w < row.length && row[x + w] !== "." && (silhouette || row[x + w] === cell))
        w += 1;
      out.push({ x, y, w, light });
      x += w;
    }
  });
  return out;
}

/**
 * A badge's 12 × 12 pixel icon (lib/badges.ts) as crisp SVG: `#` in the current text colour, `o`
 * in paper. `silhouette` draws every pixel in the current colour (a locked badge). Decorative:
 * the badge title next to it carries the meaning.
 */
export function PixelIcon({
  icon,
  silhouette = false,
  className,
}: {
  icon: readonly string[];
  silhouette?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {runs(icon, silhouette).map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill={run.light ? "var(--paper)" : "currentColor"}
        />
      ))}
    </svg>
  );
}
