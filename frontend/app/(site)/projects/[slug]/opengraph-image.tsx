import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";

import { contrastOn } from "@/components/ui/GenerativePlaceholder";
import { getHome, getProject } from "@/lib/api";
import { BOSS_TIERS, type BossTier } from "@/lib/types";
import { label } from "@/lib/utils";

/**
 * Dynamic Open Graph card per project (spec §6.3 item 7, §12): /projects/{slug}/opengraph-image.
 * The project page uses it whenever the project has no og_image / cover of its own (its
 * generateMetadata then leaves openGraph.images out, and file-based metadata fills the gap).
 *
 * ImageResponse renders JSX with Satori (flexbox only, every multi-child box needs
 * display: flex) to a PNG. Fonts: Satori takes TTF/OTF, not the WOFF2 next/font ships, so the
 * site's Bricolage Grotesque and Silkscreen are fetched from the Google Fonts API, subset to
 * exactly the characters drawn (a few KB), and cached ("use cache"). Offline → the built-in
 * font, same layout.
 */

export const alt = "Project level card: title, tagline and boss";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111111";
const PAPER = "#F3EFE6";
const LIME = "#C6F432";
const HOT = "#FF4B2B";
const VOLT = "#3D5AFE";

/** The same 7-column pixel sprites as the site's boss stickers. */
const SPRITES: Record<BossTier, string[]> = {
  minion: ["..###..", ".#####.", "##.#.##", "#######", "#######", ".#.#.#."],
  regular: ["#.....#", "##...##", ".#####.", "##.#.##", "#######", ".#.#.#."],
  final: ["#..#..#", "##.#.##", "#######", "#.#.#.#", "#######", ".#.#.#."],
};
const TIER_TEXT: Record<BossTier, string> = {
  minion: "Minion",
  regular: "Boss",
  final: "Final boss",
};
const TIER_BG: Record<BossTier, string> = { minion: LIME, regular: VOLT, final: HOT };

type FontSpec = { family: string; axes: string; name: string; weight: 400 | 600 | 800 };

const FONTS: FontSpec[] = [
  // Condensed (wdth 75) extra-bold display cut, as .hk-display.hk-condensed on the site.
  { family: "Bricolage Grotesque", axes: "opsz,wdth,wght@96,75,800", name: "Display", weight: 800 },
  { family: "Bricolage Grotesque", axes: "opsz,wght@24,600", name: "Body", weight: 600 },
  { family: "Silkscreen", axes: "wght@400", name: "Pixel", weight: 400 },
];

/** One Google font, subset to `text`, as base64 (cacheable); null when unreachable. */
async function googleFont(family: string, axes: string, text: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  try {
    const query = `family=${family.replace(/ /g, "+")}:${axes}&text=${encodeURIComponent(text)}`;
    // No browser user agent → the API answers with TrueType, which Satori can read.
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?${query}`, {
        signal: AbortSignal.timeout(4000),
      })
    ).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) return null;
    const font = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!font.ok) return null;
    return Buffer.from(await font.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

function titleSize(title: string): number {
  if (title.length <= 10) return 176;
  if (title.length <= 18) return 128;
  if (title.length <= 30) return 96;
  return 76;
}

function Sprite({ tier, color, cell }: { tier: BossTier; color: string; cell: number }) {
  const rows = SPRITES[tier];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, y) => (
        <div key={y} style={{ display: "flex" }}>
          {[...row].map((on, x) => (
            <div
              key={x}
              style={{
                width: cell,
                height: cell,
                backgroundColor: on === "#" ? color : "transparent",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function ProjectOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, home] = await Promise.all([getProject(slug), getHome()]);

  const accent = project?.accent_color ?? HOT;
  const onAccent = contrastOn(accent);
  const title = (project?.title ?? "Level not found").toUpperCase();
  const tagline = project?.tagline ?? project?.summary ?? null;
  const boss = project?.boss.enabled ? project.boss : null;
  const owner = home.site.full_name;
  const kicker = `LEVEL · ${project ? label(project.category).toUpperCase() : "404"}`;
  const bossLine = boss
    ? `${TIER_TEXT[boss.tier].toUpperCase()} · HP ${boss.hp}`
    : "OPEN LEVEL · NO BOSS";

  const pixelText = `HACKKER PLAYER ONE ${kicker} ${bossLine} ${owner.toUpperCase()} 0123456789·`;
  const bodyText = `${tagline ?? ""} ${boss?.name ?? ""} ${owner}`;
  const texts: Record<string, string> = { Display: title, Body: bodyText, Pixel: pixelText };
  const loaded = await Promise.all(
    FONTS.map(async (font) => {
      const data = await googleFont(font.family, font.axes, texts[font.name] ?? "");
      return data
        ? {
            name: font.name,
            data: Uint8Array.from(Buffer.from(data, "base64")).buffer,
            weight: font.weight,
            style: "normal" as const,
          }
        : null;
    }),
  );
  const fonts = loaded.filter((font) => font !== null);
  const family = (name: string) => (fonts.some((font) => font.name === name) ? name : undefined);

  const hpBlocks = boss
    ? Math.max(3, Math.min(12, Math.round((boss.hp / BOSS_TIERS.final) * 10)))
    : 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: accent,
        padding: 36,
        fontFamily: family("Body"),
      }}
    >
      {/* The card: paper frame with a hard ink shadow, like .hk-panel on the site. */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: accent,
          color: onAccent,
          border: `4px solid ${INK}`,
          borderRadius: "4px 28px 4px 4px",
          boxShadow: `12px 12px 0 ${INK}`,
          padding: "40px 48px 40px",
          position: "relative",
        }}
      >
        {/* Pixel grid above the name (the generative placeholder's vocabulary); low enough that
            a three-line title or a two-line tagline never runs under it. */}
        <div
          style={{
            position: "absolute",
            right: 44,
            bottom: 92,
            display: "flex",
            flexDirection: "column",
            opacity: 0.22,
          }}
        >
          {[0, 1, 2].map((y) => (
            <div key={y} style={{ display: "flex" }}>
              {[0, 1, 2, 3, 4, 5].map((x) => (
                <div
                  key={x}
                  style={{
                    width: 26,
                    height: 26,
                    margin: 4,
                    backgroundColor: (x * 7 + y * 3) % 4 === 0 ? INK : "transparent",
                    border: `3px solid ${INK}`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: INK,
              color: PAPER,
              padding: "10px 16px",
              fontSize: 22,
              letterSpacing: 1,
              fontFamily: family("Pixel"),
            }}
          >
            HACKKER · PLAYER ONE
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: PAPER,
              color: INK,
              border: `3px solid ${INK}`,
              boxShadow: `5px 5px 0 ${INK}`,
              padding: "8px 14px",
              fontSize: 22,
              transform: "rotate(-2deg)",
              fontFamily: family("Pixel"),
            }}
          >
            {kicker}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
          <div
            style={{
              display: "flex",
              fontFamily: family("Display"),
              fontWeight: 800,
              fontSize: titleSize(title),
              lineHeight: 0.86,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          {tagline ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 34,
                lineHeight: 1.2,
                fontWeight: 600,
                maxWidth: 860,
                lineClamp: 2,
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              backgroundColor: INK,
              color: PAPER,
              border: `3px solid ${INK}`,
              boxShadow: `6px 6px 0 ${boss ? TIER_BG[boss.tier] : PAPER}`,
              padding: "16px 22px",
            }}
          >
            {boss ? <Sprite tier={boss.tier} color={TIER_BG[boss.tier]} cell={8} /> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{ display: "flex", fontSize: 20, fontFamily: family("Pixel"), color: LIME }}
              >
                {bossLine}
              </div>
              {boss ? (
                <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>{boss.name}</div>
              ) : null}
              {boss ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: hpBlocks }, (_, i) => (
                    <div key={i} style={{ width: 22, height: 14, backgroundColor: LIME }} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontFamily: family("Pixel"),
              color: onAccent,
            }}
          >
            {owner.toUpperCase()}
          </div>
        </div>
      </div>
    </div>,
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
