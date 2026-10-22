"use client";

import { useState } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import { Slider as SliderPrimitive } from "radix-ui";

import { describedBy, FieldShell } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";
import { Input } from "@/components/admin/ui/input";
import { cn } from "@/lib/utils";

type GameStatFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  /** Limits and step in display units (e.g. seconds). */
  min: number;
  max: number;
  step: number;
  /**
   * Stored value = display value × scale, rounded (1000 edits `cooldown_ms` in seconds).
   * With 1 the typed number is stored as is, so the schema can reject decimals.
   */
  scale?: number;
  /** Unit after the input, e.g. "s". */
  suffix?: string;
  /** Spoken unit for the slider value, e.g. "seconds". */
  unitLabel?: string;
};

function parse(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * A game number (damage, cooldown): a number input plus a slider over the allowed range.
 * Empty input stores null. `scale` lets the UI edit seconds while the form holds milliseconds.
 */
export function GameStatField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  min,
  max,
  step,
  scale = 1,
  suffix,
  unitLabel,
}: GameStatFieldProps<T, N>) {
  const { id, inputRef, value, onChange, onBlur, error } = useBoundField(control, name);
  const stored = typeof value === "number" && Number.isFinite(value) ? value : null;
  const toStored = (display: number | null) =>
    display === null ? null : scale === 1 ? display : Math.round(display * scale);
  const display = stored === null ? null : stored / scale;

  // Same draft trick as the kit's NumberField: keep "1." while typing, show the stored value
  // again when it changes from outside (slider, reset).
  const [draft, setDraft] = useState<string | null>(null);
  const text =
    draft !== null && toStored(parse(draft)) === stored
      ? draft
      : display === null
        ? ""
        : String(display);

  const sliderValue = Math.min(max, Math.max(min, display ?? min));
  const valueText = (amount: number) => `${amount}${unitLabel ? ` ${unitLabel}` : ""}`;

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
      field={name}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-28 shrink-0 items-center gap-1.5">
          <Input
            id={id}
            ref={inputRef}
            name={name}
            type="number"
            inputMode="decimal"
            value={text}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              setDraft(event.target.value);
              const next = toStored(parse(event.target.value));
              if (next !== stored) onChange(next);
            }}
            onBlur={() => {
              setDraft(null);
              onBlur();
            }}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
            className="w-20 tabular-nums"
          />
          {suffix ? <span className="text-muted-foreground text-sm">{suffix}</span> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SliderPrimitive.Root
            value={[sliderValue]}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onValueChange={([next]) => {
              if (next === undefined) return;
              setDraft(null);
              const nextStored = toStored(next);
              if (nextStored !== stored) onChange(nextStored);
            }}
            onValueCommit={() => onBlur()}
            className={cn(
              "relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50",
              display === null && "opacity-60",
            )}
          >
            <SliderPrimitive.Track className="bg-muted relative h-1.5 grow overflow-hidden rounded-full">
              <SliderPrimitive.Range
                className={cn(
                  "absolute h-full",
                  display === null ? "bg-transparent" : "bg-primary",
                )}
              />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              aria-label={`${label} slider`}
              aria-valuetext={display === null ? "Not set" : valueText(display)}
              className={cn(
                "border-primary ring-ring/50 block size-4 rounded-full border-2 bg-white shadow-sm transition-[box-shadow] outline-none hover:ring-3 focus-visible:ring-3",
                error && "border-destructive",
              )}
            />
          </SliderPrimitive.Root>
          <div
            className="text-muted-foreground flex justify-between text-[11px] tabular-nums"
            aria-hidden
          >
            <span>
              {min}
              {suffix ? ` ${suffix}` : ""}
            </span>
            <span>
              {max}
              {suffix ? ` ${suffix}` : ""}
            </span>
          </div>
        </div>
      </div>
    </FieldShell>
  );
}
