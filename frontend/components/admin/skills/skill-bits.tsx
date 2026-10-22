import { TriangleAlertIcon } from "lucide-react";

import { MediaThumb } from "@/components/admin/table/MediaThumb";
import { Badge } from "@/components/admin/ui/badge";
import { DPS_STRONG, DPS_WEAK, type DpsWarning } from "@/components/admin/skills/skill-schema";
import type { Media } from "@/lib/types";
import { cn } from "@/lib/utils";

const WARNING_TEXT = {
  strong: { label: "Too strong", hint: `DPS above ${DPS_STRONG}` },
  weak: { label: "Too weak", hint: `DPS below ${DPS_WEAK}` },
} as const;

/** Soft "too strong / too weak" badge for a DPS outside the 15–30 guideline. */
export function DpsWarningBadge({
  warning,
  className,
}: {
  warning: DpsWarning;
  className?: string;
}) {
  if (!warning) return null;
  const text = WARNING_TEXT[warning];
  return (
    <Badge
      variant="outline"
      title={`${text.hint}: outside the ${DPS_WEAK}–${DPS_STRONG} guideline`}
      className={cn(
        warning === "strong"
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-sky-300 bg-sky-50 text-sky-800",
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden />
      {text.label}
      <span className="sr-only">
        ({text.hint}, guideline {DPS_WEAK} to {DPS_STRONG})
      </span>
    </Badge>
  );
}

/** Five pips, filled up to the level. */
export function LevelPips({ level, className }: { level: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Level ${level} of 5`}
      title={`Level ${level} of 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((pip) => (
        <span
          key={pip}
          aria-hidden
          className={cn(
            "size-2 rounded-[2px] border",
            pip <= level ? "border-foreground/70 bg-foreground/70" : "border-border bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/** Uploaded icon, or a small tile with the icon key / name initials. */
export function SkillIcon({
  icon,
  iconKey,
  name,
}: {
  icon: Media | null;
  iconKey: string | null;
  name: string;
}) {
  if (icon) return <MediaThumb media={icon} size="xs" label={name} fit="contain" />;
  const text = (iconKey ?? name).replace(/[^a-z0-9]/gi, "").slice(0, 2) || "?";
  return (
    <span
      aria-hidden
      title={iconKey ? `Icon key: ${iconKey}` : "No icon"}
      className="bg-muted text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold uppercase"
    >
      {text}
    </span>
  );
}
