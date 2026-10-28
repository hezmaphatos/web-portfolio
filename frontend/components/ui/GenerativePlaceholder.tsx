/**
 * Stand-in artwork for any missing image (spec §2: "generative placeholder", never a grey box).
 * Deterministic: the same seed always draws the same tile pattern, so a project keeps its look
 * until a real cover is uploaded. Pure SVG, rendered on the server.
 */

type Props = {
  seed: string;
  accent?: string;
  /** Width / height. The SVG scales to its box; this only shapes the grid. */
  ratio?: number;
  label?: string;
  className?: string;
};

const INK = "#111111";
const round = (n: number) => Math.round(n * 100) / 100;
const PAPER = "#F3EFE6";

/** FNV-1a → small seeded PRNG (mulberry32). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ink or paper, whichever reads better on the accent. */
export function contrastOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return INK;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.22 ? INK : PAPER;
}

export function GenerativePlaceholder({
  seed,
  accent = "#FF4B2B",
  ratio = 16 / 10,
  label,
  className,
}: Props) {
  const random = rng(seed);
  const cols = ratio >= 1 ? 6 : 4;
  const rows = Math.max(2, Math.round(cols / ratio));
  const size = 100;
  const width = cols * size;
  const height = rows * size;
  const palette = [accent, INK, PAPER, accent, contrastOn(accent) === INK ? PAPER : INK];

  // One <path> per colour instead of a <g> + shapes per tile: a 6 × 4 tile cover was ~100 SVG
  // nodes, and the Home carries a dozen of them (style/layout cost on every recalc, phase 8B).
  // Tiles never overlap, so painting every background first and every shape second keeps the
  // look of the per-tile drawing.
  const backgrounds = new Map<string, string>();
  const shapes = new Map<string, string>();
  const add = (paths: Map<string, string>, fill: string, d: string) =>
    paths.set(fill, (paths.get(fill) ?? "") + d);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * size;
      const py = y * size;
      const bg = palette[Math.floor(random() * palette.length)];
      let fg = palette[Math.floor(random() * palette.length)];
      if (fg === bg) fg = bg === INK ? PAPER : INK;
      const kind = Math.floor(random() * 6);
      const turns = Math.floor(random() * 4); // quarter turns around the tile centre
      const c = size / 2;
      /** Tile-local point → rotated, translated "x y". */
      const at = (lx: number, ly: number) => {
        const dx = lx - c;
        const dy = ly - c;
        const [rx, ry] = [
          [dx, dy],
          [-dy, dx],
          [-dx, -dy],
          [dy, -dx],
        ][turns];
        return `${round(px + c + rx)} ${round(py + c + ry)}`;
      };
      const polygon = (points: Array<[number, number]>) =>
        `M${points.map(([lx, ly]) => at(lx, ly)).join("L")}Z`;

      add(backgrounds, bg, `M${px} ${py}h${size}v${size}h-${size}Z`);
      if (kind === 0) {
        const r = round(size * 0.38);
        add(
          shapes,
          fg,
          `M${round(px + c - r)} ${py + c}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0Z`,
        );
      } else if (kind === 1) {
        // Quarter disc: a rotation keeps the arc's sweep direction.
        add(shapes, fg, `M${at(0, 0)}L${at(size, 0)}A${size} ${size} 0 0 1 ${at(0, size)}Z`);
      } else if (kind === 2) {
        add(
          shapes,
          fg,
          polygon([
            [0, 0],
            [size, 0],
            [0, size],
          ]),
        );
      } else if (kind === 3) {
        for (let i = 0; i < 4; i++) {
          const top = i * 25 + 6;
          add(
            shapes,
            fg,
            polygon([
              [0, top],
              [size, top],
              [size, top + 12],
              [0, top + 12],
            ]),
          );
        }
      } else if (kind === 4) {
        add(
          shapes,
          fg,
          polygon([
            [22, 22],
            [78, 22],
            [78, 78],
            [22, 78],
          ]),
        );
      }
      // kind 5: empty tile, keeps the pattern from getting busy.
    }
  }

  let grid = "";
  for (let i = 0; i <= cols; i++) grid += `M${i * size} 0V${height}`;
  for (let i = 0; i <= rows; i++) grid += `M0 ${i * size}H${width}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {[...backgrounds, ...shapes].map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
      {/* Grid lines: the hard ink rule that ties it to the rest of the site. */}
      <path d={grid} stroke={INK} strokeWidth={4} fill="none" />
    </svg>
  );
}
