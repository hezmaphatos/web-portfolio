"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { AlertTriangleIcon, CheckCircle2Icon, SwordsIcon, TimerIcon } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import type { AnyControl } from "@/components/admin/form";
import { useMediaItem } from "@/components/admin/media";
import { KitError } from "@/components/admin/table";
import { PixelBoss } from "@/components/admin/projects/PixelBoss";
import {
  BOSS_HP_MAX,
  BOSS_HP_MIN,
  BOSS_TIER_LABEL,
  CLEAR_TIME_TARGET_MS,
  type ProjectFormValues,
} from "@/components/admin/projects/project-form";
import { useAllSkills } from "@/components/admin/projects/project-queries";
import {
  bestLoadout,
  defaultLoadout,
  FINAL_PHASE_THRESHOLDS,
  formatClearTime,
  simulate,
  type GameSkill,
  type Simulation,
} from "@/lib/battle";
import type { AdminSkill, BossTier, Media } from "@/lib/types";
import { cn } from "@/lib/utils";

type BossPreviewProps = {
  control: AnyControl<ProjectFormValues>;
  /** `boss_sprite` of the saved row (avoids a lookup while the id is unchanged). */
  initialSprite: Media | null;
};

const EMPTY_SKILLS: AdminSkill[] = [];

/**
 * Boss Preview (spec §7 Boss tab): sprite or generated fallback, name, HP bar and the estimated
 * clear time from `simulate()` for the default loadout and the best loadout, recomputed live.
 */
export function BossPreview({ control, initialSprite }: BossPreviewProps) {
  const [enabled, tier, hpValue, name, title, slug, color, spriteId] = useWatch({
    control,
    name: [
      "boss_enabled",
      "boss_tier",
      "boss_hp",
      "boss_name",
      "title",
      "slug",
      "accent_color",
      "boss_media_id",
    ],
  });
  const hp = typeof hpValue === "number" && Number.isFinite(hpValue) ? hpValue : null;
  const hpValid = hp !== null && Number.isInteger(hp) && hp >= BOSS_HP_MIN && hp <= BOSS_HP_MAX;
  const bossName = name?.trim() || title?.trim() || "Unnamed boss";

  const skills = useAllSkills();
  const all = skills.data ?? EMPTY_SKILLS;
  // The site only equips visible skills; soft skills are never game skills (lib/battle).
  const pool = useMemo(() => all.filter((skill) => skill.is_visible), [all]);
  const fallbackLoadout = useMemo(() => defaultLoadout(pool), [pool]);
  const best = useMemo(
    () => (hpValid ? bestLoadout(pool, hp) : fallbackLoadout),
    [pool, hp, hpValid, fallbackLoadout],
  );
  const defaultSim = useMemo(
    () => (hpValid ? simulate(fallbackLoadout, hp) : null),
    [fallbackLoadout, hp, hpValid],
  );
  const bestSim = useMemo(() => (hpValid ? simulate(best, hp) : null), [best, hp, hpValid]);
  const sameLoadout =
    best.length === fallbackLoadout.length &&
    best.every((skill) => fallbackLoadout.some((other) => other.id === skill.id));

  const spriteLookup = useMediaItem(
    spriteId !== null && spriteId !== initialSprite?.id ? spriteId : null,
  );
  const sprite: Media | null =
    spriteId === null
      ? null
      : spriteId === initialSprite?.id
        ? initialSprite
        : (spriteLookup.data ?? null);

  return (
    <Card role="region" aria-labelledby="boss-preview-title">
      <CardHeader className="border-b">
        <CardTitle>
          <h2 id="boss-preview-title" className="flex items-center gap-2">
            <SwordsIcon className="size-4" aria-hidden />
            Boss Preview
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!enabled ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
            The boss is off: this project has no Battle Arena and every tech chip and link is open
            from the start.
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <div
            className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border p-2"
            style={{ backgroundColor: "#F3EFE6" }}
          >
            {sprite ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview straight from storage
              <img
                src={sprite.thumb_url ?? sprite.url}
                alt={sprite.alt ?? `${bossName} sprite`}
                className="size-full object-contain [image-rendering:pixelated]"
              />
            ) : spriteId !== null && spriteLookup.isPending ? (
              <Skeleton className="size-full" />
            ) : (
              <PixelBoss
                seed={slug || title || "boss"}
                color={color}
                tier={tier}
                label={`Generated pixel boss for ${bossName}`}
                className="size-full"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="truncate text-base font-semibold" title={bossName}>
              {bossName}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <TierBadge tier={tier} />
              {!sprite ? (
                <span className="text-muted-foreground text-xs">Generated sprite</span>
              ) : null}
            </div>
          </div>
        </div>

        <HpBar hp={hpValid ? hp : null} tier={tier} color={color} />

        <section aria-labelledby="boss-estimate-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id="boss-estimate-title" className="flex items-center gap-1.5 text-sm font-medium">
              <TimerIcon className="size-4" aria-hidden />
              Estimated clear time
            </h3>
            <span className="text-muted-foreground text-xs">
              Target {CLEAR_TIME_TARGET_MS.min / 1000}–{CLEAR_TIME_TARGET_MS.max / 1000} s
            </span>
          </div>

          {skills.isPending ? (
            <div className="flex flex-col gap-2" role="status" aria-label="Loading skills">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : skills.isError ? (
            <KitError
              error={skills.error}
              onRetry={() => void skills.refetch()}
              title="Could not load skills"
              className="py-4"
            />
          ) : pool.length === 0 || fallbackLoadout.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No visible game skills yet. Give skills damage and a cooldown (Skills menu) to
              estimate a fight.
            </p>
          ) : !hpValid ? (
            <p className="text-muted-foreground text-sm">
              Enter a boss HP from {BOSS_HP_MIN} to {BOSS_HP_MAX} to see the estimate.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5" aria-live="polite">
              <LoadoutEstimate
                title="Default loadout"
                description="4 highest-damage visible skills (what a new visitor has)"
                loadout={fallbackLoadout}
                simulation={defaultSim}
              />
              <LoadoutEstimate
                title="Best loadout"
                description={
                  sameLoadout
                    ? "The default loadout is already the fastest."
                    : "Fastest 4 visible skills for this HP"
                }
                loadout={best}
                simulation={bestSim}
              />
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Assumes perfect play: every slot starts charging and fires the instant it is ready
            (Auto-fire). Real fights take a little longer.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

function TierBadge({ tier }: { tier: BossTier }) {
  return (
    <Badge
      variant={tier === "final" ? "default" : "secondary"}
      className={cn(tier === "minion" && "bg-muted text-muted-foreground")}
    >
      {BOSS_TIER_LABEL[tier]} boss
    </Badge>
  );
}

function HpBar({ hp, tier, color }: { hp: number | null; tier: BossTier; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>HP</span>
        <span className="tabular-nums">{hp === null ? "—" : `${hp} / ${hp}`}</span>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-sm border-2 border-[#111111] bg-white"
        role="img"
        aria-label={hp === null ? "Boss HP not set" : `Boss HP ${hp} of ${hp}`}
      >
        <div
          className="h-full"
          style={{ width: hp === null ? "0%" : "100%", backgroundColor: color || "#FF4B2B" }}
        />
        {tier === "final"
          ? FINAL_PHASE_THRESHOLDS.map((threshold) => (
              <span
                key={threshold}
                className="absolute inset-y-0 w-0.5 bg-[#111111]"
                style={{ left: `${threshold}%` }}
                aria-hidden
              />
            ))
          : null}
      </div>
      {tier === "final" ? (
        <p className="text-muted-foreground text-xs">
          Final boss: the sprite changes phase at {FINAL_PHASE_THRESHOLDS[0]} % and{" "}
          {FINAL_PHASE_THRESHOLDS[1]} % HP.
        </p>
      ) : null}
    </div>
  );
}

function LoadoutEstimate({
  title,
  description,
  loadout,
  simulation,
}: {
  title: string;
  description: string;
  loadout: readonly GameSkill[];
  simulation: Simulation | null;
}) {
  const ms = simulation?.clearTimeMs ?? Number.NaN;
  const tooFast = Number.isFinite(ms) && ms < CLEAR_TIME_TARGET_MS.min;
  const tooSlow = Number.isFinite(ms) && ms > CLEAR_TIME_TARGET_MS.max;
  const inRange = Number.isFinite(ms) && !tooFast && !tooSlow;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        (tooFast || tooSlow) && "border-amber-300 bg-amber-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl leading-none font-semibold tabular-nums">{formatClearTime(ms)}</p>
          {simulation && Number.isFinite(ms) ? (
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              {simulation.hits} {simulation.hits === 1 ? "hit" : "hits"}
            </p>
          ) : null}
        </div>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1" aria-label={`${title} skills`}>
        {loadout.map((skill, index) => (
          <li
            key={skill.id}
            className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
            title={`${skill.attack_name}: ${skill.damage} damage every ${(skill.cooldown_ms / 1000).toFixed(1)} s`}
          >
            <span className="text-muted-foreground tabular-nums" aria-hidden>
              {index + 1}
            </span>
            <span className="font-medium">{skill.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {skill.damage}/{(skill.cooldown_ms / 1000).toFixed(1)}s
            </span>
          </li>
        ))}
      </ol>
      {tooFast ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
          Quicker than the {CLEAR_TIME_TARGET_MS.min / 1000} s target: consider more HP.
        </p>
      ) : tooSlow ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
          Longer than the {CLEAR_TIME_TARGET_MS.max / 1000} s target: consider less HP.
        </p>
      ) : inRange ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden />
          Within the target range.
        </p>
      ) : null}
    </div>
  );
}
