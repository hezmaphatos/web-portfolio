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

  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * size;
      const py = y * size;
      const bg = palette[Math.floor(random() * palette.length)];
      let fg = palette[Math.floor(random() * palette.length)];
      if (fg === bg) fg = bg === INK ? PAPER : INK;
      const kind = Math.floor(random() * 6);
      const rot = Math.floor(random() * 4) * 90;
      const key = `${x}-${y}`;
      const c = size / 2;
      let shape: React.ReactNode = null;
      if (kind === 0) shape = <circle cx={c} cy={c} r={size * 0.38} fill={fg} />;
      else if (kind === 1)
        shape = <path d={`M0 0 H${size} A${size} ${size} 0 0 1 0 ${size} Z`} fill={fg} />;
      else if (kind === 2) shape = <path d={`M0 0 L${size} 0 L0 ${size} Z`} fill={fg} />;
      else if (kind === 3)
        shape = (
          <g fill={fg}>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={0} y={i * 25 + 6} width={size} height={12} />
            ))}
          </g>
        );
      else if (kind === 4) shape = <rect x={22} y={22} width={56} height={56} fill={fg} />;
      // kind 5: empty tile, keeps the pattern from getting busy.
      tiles.push(
        <g key={key} transform={`translate(${px} ${py}) rotate(${rot} ${c} ${c})`}>
          <rect width={size} height={size} fill={bg} />
          {shape}
        </g>,
      );
    }
  }

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
      {tiles}
      {/* Grid lines: the hard ink rule that ties it to the rest of the site. */}
      <g stroke={INK} strokeWidth={4}>
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * size} y1={0} x2={i * size} y2={height} />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * size} x2={width} y2={i * size} />
        ))}
      </g>
    </svg>
  );
}
