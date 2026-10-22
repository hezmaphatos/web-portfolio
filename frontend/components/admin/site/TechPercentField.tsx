"use client";

import { useState } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { LockIcon, RotateCcwIcon } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";

import { describedBy, FieldShell } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";
import { DEFAULT_TECH_PERCENT } from "@/components/admin/site/site-schema";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { visibleTechCount } from "@/lib/battle";
import { cn } from "@/lib/utils";

/** Tech-stack sizes shown in the live example (the seed projects have 2–4). */
const EXAMPLE_SIZES = [1, 2, 3, 4, 6, 8] as const;

function parsePercent(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const value = Number(text);
  return value >= 0 && value <= 100 ? value : null;
}

/**
 * `tech_visible_percent` (0–100): a slider and a number input bound to the same value, plus a
 * live example of the lock rule (`visibleTechCount` from lib/battle, spec §6.4).
 */
export function TechPercentField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: Omit<FieldBaseProps<T, N>, "required">) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const stored = typeof fieldValue === "number" ? fieldValue : DEFAULT_TECH_PERCENT;
  // What the number input shows while typing; only valid whole numbers 0–100 reach the form.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(stored);
  const draftInvalid = draft !== null && parsePercent(draft) === null;
  const hintId = `${id}-range`;

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      className={className}
      field={name}
      aside={
        stored !== DEFAULT_TECH_PERCENT ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => {
              setDraft(null);
              onChange(DEFAULT_TECH_PERCENT);
            }}
          >
            <RotateCcwIcon aria-hidden />
            Reset to {DEFAULT_TECH_PERCENT}%
          </Button>
        ) : null
      }
    >
      <div className="flex items-center gap-4">
        <SliderPrimitive.Root
          value={[stored]}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          onValueChange={([next]) => {
            setDraft(null);
            if (typeof next === "number") onChange(next);
          }}
          onValueCommit={() => onBlur()}
          className="relative flex h-5 w-full max-w-md touch-none items-center select-none data-disabled:opacity-50"
        >
          <SliderPrimitive.Track className="bg-muted relative h-1.5 grow overflow-hidden rounded-full">
            <SliderPrimitive.Range className="bg-primary absolute h-full" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label={`${label} (slider)`}
            aria-valuetext={`${stored}%`}
            className="border-primary ring-ring/50 block size-4 rounded-full border-2 bg-white shadow-sm transition-[box-shadow] outline-none hover:ring-3 focus-visible:ring-3"
          />
        </SliderPrimitive.Root>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            ref={inputRef}
            name={name}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={text}
            disabled={disabled}
            onChange={(event) => {
              setDraft(event.target.value);
              const next = parsePercent(event.target.value);
              if (next !== null && next !== stored) onChange(next);
            }}
            onBlur={() => {
              setDraft(null); // an invalid draft falls back to the stored value
              onBlur();
            }}
            aria-invalid={error || draftInvalid ? true : undefined}
            aria-describedby={
              [describedBy(id, Boolean(description), Boolean(error)), draftInvalid && hintId]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className="w-20 tabular-nums"
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
      </div>
      {draftInvalid ? (
        <p id={hintId} className="text-xs text-amber-800">
          Use a whole number from 0 to 100; leaving the field keeps {stored}%.
        </p>
      ) : null}

      <TechExample percent={stored} />
    </FieldShell>
  );
}

/** "4 tech → 2 visible, 2 locked" for a few stack sizes, with open / locked chips. */
function TechExample({ percent }: { percent: number }) {
  return (
    <div className="bg-muted/40 mt-1 rounded-lg border p-3">
      <p className="text-sm font-medium">
        At {percent}%, a boss project with…
        <span className="sr-only"> (examples update as you change the value)</span>
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {EXAMPLE_SIZES.map((size) => {
          const visible = visibleTechCount(size, percent);
          const locked = size - visible;
          return (
            <li key={size} className="flex items-center gap-3 text-sm">
              <span className="flex w-40 shrink-0 gap-1" aria-hidden>
                {Array.from({ length: size }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border",
                      index < visible
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40 border-dashed bg-transparent",
                    )}
                  >
                    {index >= visible ? (
                      <LockIcon className="text-muted-foreground size-2.5" />
                    ) : null}
                  </span>
                ))}
              </span>
              <span className="tabular-nums">
                {size} tech → {visible} visible, {locked} locked
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground mt-2 text-xs">
        Visible = min(n − 1, ⌈n × {percent} / 100⌉): at least one chip stays locked until the boss
        is defeated, and a single-tech project shows none. Projects without a boss always show their
        full stack.
      </p>
    </div>
  );
}
