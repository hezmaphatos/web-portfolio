import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";

type Props = {
  device: Device;
  /** The screen content: a fixed-ratio box (<Media>, later the Live iframe). */
  children: React.ReactNode;
  /** Text in the desktop address bar (e.g. the site host). */
  address?: string;
  className?: string;
};

/**
 * Device frames drawn in CSS (spec §6.3 Preview Deck): a browser window for desktop, a slab
 * with a camera dot for tablet, a phone with a speaker pill for mobile. Purely decorative
 * chrome around the screen, so it is aria-hidden except for the screen itself.
 * Phase 6 reuses it for the device switcher, the in-frame auto-scroll ([data-screen]) and the
 * Live preview iframe.
 */
export function DeviceFrame({ device, children, address, className }: Props) {
  if (device === "desktop") {
    return (
      <div
        className={cn(
          "border-ink bg-paper overflow-hidden rounded-[10px_10px_3px_3px] border-2",
          className,
        )}
        data-device-frame
        data-device="desktop"
      >
        <div
          aria-hidden="true"
          className="border-ink bg-paper flex h-8 items-center gap-3 border-b-2 px-3"
        >
          <span className="flex gap-1.5">
            <span className="border-ink bg-hot size-2.5 rounded-full border-2" />
            <span className="border-ink bg-lime size-2.5 rounded-full border-2" />
            <span className="border-ink bg-paper size-2.5 rounded-full border-2" />
          </span>
          <span className="hk-mono bg-paper-2 text-ink-2 min-w-0 flex-1 truncate rounded-full px-3 py-0.5 text-[0.6875rem]">
            {address ?? "localhost"}
          </span>
        </div>
        <div data-screen>{children}</div>
      </div>
    );
  }

  if (device === "tablet") {
    return (
      <div
        className={cn("border-ink bg-ink relative rounded-[22px] border-2 p-[10px]", className)}
        data-device-frame
        data-device="tablet"
      >
        <span
          aria-hidden="true"
          className="bg-paper-2 absolute top-[3px] left-1/2 size-1 -translate-x-1/2 rounded-full"
        />
        <div className="overflow-hidden rounded-[8px]" data-screen>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("border-ink bg-ink relative rounded-[30px] border-2 p-[7px]", className)}
      data-device-frame
      data-device="mobile"
    >
      <div className="relative overflow-hidden rounded-[23px]" data-screen>
        {children}
        <span
          aria-hidden="true"
          className="bg-ink absolute top-2 left-1/2 h-[14px] w-[34%] -translate-x-1/2 rounded-full"
        />
      </div>
    </div>
  );
}
