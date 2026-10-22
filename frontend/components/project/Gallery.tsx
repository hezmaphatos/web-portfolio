import { Media } from "@/components/ui/Media";
import { cn } from "@/lib/utils";
import type { Device, GalleryImage } from "@/lib/types";

import { DeviceFrame } from "./DeviceFrame";

type Props = {
  items: GalleryImage[];
  /** Project title, for alt text when a screenshot has none of its own. */
  title: string;
  seed: string;
  accent: string;
  /** Shown in the desktop frame's address bar. */
  address?: string;
  className?: string;
};

/** Allowed screen ratios (width / height) per device; anything taller is cropped to the top. */
const RATIO: Record<Device, { min: number; max: number; fallback: number }> = {
  desktop: { min: 4 / 3, max: 21 / 9, fallback: 16 / 10 },
  tablet: { min: 3 / 4, max: 4 / 3, fallback: 3 / 4 },
  mobile: { min: 9 / 20, max: 9 / 16, fallback: 9 / 19.5 },
};

function screenRatio(item: GalleryImage): number {
  const { min, max, fallback } = RATIO[item.device];
  if (!item.width || !item.height) return fallback;
  return Math.min(max, Math.max(min, item.width / item.height));
}

const DEVICE_NAME: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/**
 * Screenshots in device frames (static Preview Deck, spec §6.3). Desktop shots get the wide
 * row, tablet and phone shots share a bottom-aligned row. Phase 6 turns this into the device
 * switcher with drag carousel, in-frame auto-scroll and the lightbox ([data-gallery-item]).
 */
export function Gallery({ items, title, seed, accent, address, className }: Props) {
  if (items.length === 0) return null;

  const desktop = items.filter((item) => item.device === "desktop");
  const small = items.filter((item) => item.device !== "desktop");

  const figure = (item: GalleryImage, index: number, sizes: string, figureClass?: string) => (
    <figure
      key={item.id}
      className={cn("flex flex-col gap-3", figureClass)}
      data-gallery-item={index}
    >
      <DeviceFrame
        device={item.device}
        address={address}
        className="shadow-[6px_6px_0_var(--accent)]"
      >
        <Media
          media={item}
          alt={`${title}: ${DEVICE_NAME[item.device].toLowerCase()} screenshot ${index + 1}`}
          seed={`${seed}-${item.id}`}
          accent={accent}
          ratio={screenRatio(item)}
          sizes={sizes}
          imgClassName="object-top"
        />
      </DeviceFrame>
      {item.caption ? (
        <figcaption className="text-ink-2 max-w-prose text-sm">
          <span className="hk-pixel text-ink mr-2 text-[0.6875rem]">
            {DEVICE_NAME[item.device]}
          </span>
          {item.caption}
        </figcaption>
      ) : null}
    </figure>
  );

  return (
    <div className={cn("flex flex-col gap-12", className)} data-gallery>
      {desktop.length > 0 ? (
        <div
          className={cn(
            "grid gap-x-8 gap-y-12",
            desktop.length > 1 ? "md:grid-cols-2" : "max-w-4xl",
          )}
        >
          {desktop.map((item) =>
            figure(
              item,
              items.indexOf(item),
              desktop.length > 1
                ? "(min-width: 768px) 36rem, 100vw"
                : "(min-width: 768px) 56rem, 100vw",
            ),
          )}
        </div>
      ) : null}

      {small.length > 0 ? (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-12 md:gap-x-10">
          {small.map((item) =>
            figure(
              item,
              items.indexOf(item),
              item.device === "tablet" ? "(min-width: 768px) 22rem, 80vw" : "14rem",
              item.device === "tablet" ? "w-[min(80vw,22rem)]" : "w-[min(40vw,14rem)]",
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
