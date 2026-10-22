"use client";

import { useWatch } from "react-hook-form";
import { GaugeIcon } from "lucide-react";

import type { AnyControl } from "@/components/admin/form/types";
import { DpsWarningBadge } from "@/components/admin/skills/skill-bits";
import {
  COOLDOWN_MAX_MS,
  COOLDOWN_MIN_MS,
  DAMAGE_MAX,
  DAMAGE_MIN,
  DPS_STRONG,
  DPS_WEAK,
  dpsWarning,
  formatSeconds,
  skillDps,
  type SkillFormInput,
} from "@/components/admin/skills/skill-schema";
import { Badge } from "@/components/admin/ui/badge";
import { clearTime, formatClearTime, TRAINING_DUMMY_HP } from "@/lib/battle";
import { cn } from "@/lib/utils";

/** Right end of the meter; higher DPS values pin to the end. */
const METER_MAX = 45;

function percent(value: number): number {
  return (Math.min(METER_MAX, Math.max(0, value)) / METER_MAX) * 100;
}

function inRange(damage: number | null, cooldownMs: number | null): boolean {
  return (
    damage !== null &&
    cooldownMs !== null &&
    Number.isInteger(damage) &&
    damage >= DAMAGE_MIN &&
    damage <= DAMAGE_MAX &&
    cooldownMs >= COOLDOWN_MIN_MS &&
    cooldownMs <= COOLDOWN_MAX_MS
  );
}

/** Live DPS (damage ÷ cooldown) while editing, against the 15–30 guideline. */
export function DpsReadout({
  control,
  className,
}: {
  control: AnyControl<SkillFormInput>;
  className?: string;
}) {
  const [name, attackName, damage, cooldownMs] = useWatch({
    control,
    name: ["name", "attack_name", "damage", "cooldown_ms"],
  });
  const value = skillDps(damage, cooldownMs);
  const warning = dpsWarning(value);
  const valid = value !== null && inRange(damage, cooldownMs);

  const attack = attackName?.trim() || name?.trim() || "This skill";
  const hits = valid && damage ? Math.ceil(TRAINING_DUMMY_HP / damage) : null;
  const solo =
    valid && damage && cooldownMs
      ? clearTime(
          [
            {
              id: 0,
              name: name || "Skill",
              attack_name: attack,
              damage,
              cooldown_ms: cooldownMs,
              level: 1,
              sort_order: 0,
            },
          ],
          TRAINING_DUMMY_HP,
        )
      : null;

  return (
    <div className={cn("bg-muted/40 flex flex-col gap-3 rounded-lg border p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <GaugeIcon className="text-muted-foreground size-4" aria-hidden />
          Damage per second
        </p>
        {/* role=status: announced politely as the numbers change. */}
        <p role="status" className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {value === null ? "—" : value.toFixed(1)}
          </span>
          <span className="sr-only">damage per second</span>
          {value === null ? null : warning ? (
            <DpsWarningBadge warning={warning} />
          ) : (
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
              Balanced
            </Badge>
          )}
        </p>
      </div>

      <div aria-hidden className="flex flex-col gap-1">
        <div className="bg-background relative h-2.5 rounded-full border">
          <div
            className="absolute inset-y-0 rounded-full bg-emerald-200"
            style={{
              left: `${percent(DPS_WEAK)}%`,
              width: `${percent(DPS_STRONG) - percent(DPS_WEAK)}%`,
            }}
          />
          {value !== null ? (
            <div
              className={cn(
                "absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                warning === "strong"
                  ? "bg-amber-600"
                  : warning === "weak"
                    ? "bg-sky-600"
                    : "bg-emerald-700",
              )}
              style={{ left: `${percent(value)}%` }}
            />
          ) : null}
        </div>
        <div className="text-muted-foreground relative h-4 text-[11px] tabular-nums">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${percent(DPS_WEAK)}%` }}>
            {DPS_WEAK}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${percent(DPS_STRONG)}%` }}>
            {DPS_STRONG}
          </span>
          <span className="absolute right-0">{METER_MAX}+</span>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        {valid && damage && cooldownMs ? (
          <>
            <p>
              In battle: <span className="text-foreground font-medium">“{attack}”</span> hits for{" "}
              <span className="text-foreground tabular-nums">{damage}</span> every{" "}
              <span className="text-foreground tabular-nums">{formatSeconds(cooldownMs)} s</span>.
            </p>
            <p>
              Alone against the Training Dummy ({TRAINING_DUMMY_HP} HP):{" "}
              <span className="text-foreground tabular-nums">
                {hits} {hits === 1 ? "hit" : "hits"}, {formatClearTime(solo ?? Number.NaN)}
              </span>
              .
            </p>
          </>
        ) : (
          <p>
            Set damage ({DAMAGE_MIN}–{DAMAGE_MAX}) and cooldown (1–4 s) to see the numbers.
          </p>
        )}
        <p className="text-xs">
          Guideline: keep DPS between {DPS_WEAK} and {DPS_STRONG}. Higher-level skills should hit
          harder but recharge slower. The warning is only a hint; saving is never blocked.
        </p>
      </div>
    </div>
  );
}
