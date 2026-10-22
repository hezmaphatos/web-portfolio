"use client";

import { useState, type ReactNode } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { describedBy, FieldError, FieldShell } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";
import { cn } from "@/lib/utils";

/* ── Text ─────────────────────────────────────────────────────────────── */

type TextFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  type?: "text" | "email" | "url" | "tel" | "password" | "search";
  placeholder?: string;
  /** Store "" as null (nullable DB columns). */
  nullable?: boolean;
  autoComplete?: string;
  maxLength?: number;
  inputClassName?: string;
};

export function TextField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  type = "text",
  placeholder,
  nullable = false,
  autoComplete,
  maxLength,
  inputClassName,
}: TextFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const value = (fieldValue as string | null | undefined) ?? "";

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
      <Input
        id={id}
        ref={inputRef}
        name={name}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(nullable && event.target.value === "" ? null : event.target.value)
        }
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
        className={inputClassName}
      />
    </FieldShell>
  );
}

/* ── Textarea ─────────────────────────────────────────────────────────── */

type TextareaFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  placeholder?: string;
  rows?: number;
  nullable?: boolean;
  /** Also shows a "n / max" counter. */
  maxLength?: number;
  textareaClassName?: string;
};

export function TextareaField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  placeholder,
  rows = 4,
  nullable = false,
  maxLength,
  textareaClassName,
}: TextareaFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const value = (fieldValue as string | null | undefined) ?? "";

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
      field={name}
      aside={
        maxLength ? (
          <span
            className={cn(
              "text-muted-foreground text-xs tabular-nums",
              value.length > maxLength && "text-destructive",
            )}
            aria-live="polite"
          >
            {value.length} / {maxLength}
          </span>
        ) : null
      }
    >
      <Textarea
        id={id}
        ref={inputRef}
        name={name}
        value={value}
        rows={rows}
        onChange={(event) =>
          onChange(nullable && event.target.value === "" ? null : event.target.value)
        }
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
        className={textareaClassName}
      />
    </FieldShell>
  );
}

/* ── Number ───────────────────────────────────────────────────────────── */

type NumberFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  /** Unit after the input, e.g. "ms" or "HP". */
  suffix?: ReactNode;
  inputClassName?: string;
};

function parseNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Number input; an empty input stores `null`. */
export function NumberField<T extends FieldValues, N extends FieldPath<T>>({
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
  placeholder,
  suffix,
  inputClassName,
}: NumberFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const current = (fieldValue as number | null | undefined) ?? null;
  // While typing, show exactly what the browser reports ("1." / "-") so the caret never jumps;
  // when the value changes from outside (reset, tier presets) the draft no longer parses to it
  // and the stored value is shown instead.
  const [draft, setDraft] = useState<string | null>(null);
  const text =
    draft !== null && parseNumber(draft) === current
      ? draft
      : current === null
        ? ""
        : String(current);

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
      <div className="flex items-center gap-2">
        <Input
          id={id}
          ref={inputRef}
          name={name}
          type="number"
          inputMode="decimal"
          value={text}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = parseNumber(event.target.value);
            if (next !== current) onChange(next);
          }}
          onBlur={() => {
            setDraft(null); // show the stored value again ("01" → "1")
            onBlur();
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
          className={cn("max-w-40", inputClassName)}
        />
        {suffix ? <span className="text-muted-foreground text-sm">{suffix}</span> : null}
      </div>
    </FieldShell>
  );
}

/* ── Select ───────────────────────────────────────────────────────────── */

export type SelectOption = { value: string | number; label: string; disabled?: boolean };

type SelectFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  /** `["web", "mobile"]` (label = value, capitalised) or `{ value, label }` objects. */
  options: ReadonlyArray<SelectOption | string | number>;
  placeholder?: string;
  /** Adds a "None" item that stores null. */
  nullable?: boolean;
  noneLabel?: string;
  /** Store numbers (e.g. level 1–5) instead of strings. */
  numeric?: boolean;
  triggerClassName?: string;
};

const NONE = "__none__";

function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toOption(option: SelectOption | string | number): SelectOption {
  if (typeof option === "object") return option;
  return { value: option, label: typeof option === "string" ? humanize(option) : String(option) };
}

export function SelectField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  options,
  placeholder = "Select…",
  nullable = false,
  noneLabel = "None",
  numeric = false,
  triggerClassName,
}: SelectFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const raw = fieldValue as string | number | null | undefined;
  const value =
    raw === null || raw === undefined || raw === "" ? (nullable ? NONE : "") : String(raw);

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
      <Select
        value={value}
        onValueChange={(next) => {
          if (next === NONE) onChange(null);
          else onChange(numeric ? Number(next) : next);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          ref={inputRef}
          onBlur={onBlur}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
          className={cn("w-full", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {nullable ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map(toOption).map((option) => (
            <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

/* ── Switch / Checkbox ────────────────────────────────────────────────── */

type ToggleFieldProps<T extends FieldValues, N extends FieldPath<T>> = Omit<
  FieldBaseProps<T, N>,
  "required"
>;

function ToggleRow({
  id,
  label,
  description,
  error,
  className,
  field,
  children,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  className?: string;
  field: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)} data-field={field}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{children}</div>
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id} className="leading-snug">
            {label}
          </Label>
          {description ? (
            <p id={`${id}-description`} className="text-muted-foreground text-xs">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** On/off setting (is_visible, show_phone, boss_enabled…). */
export function SwitchField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: ToggleFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);

  return (
    <ToggleRow
      id={id}
      label={label}
      description={description}
      error={error}
      className={className}
      field={name}
    >
      <Switch
        id={id}
        ref={inputRef}
        name={name}
        checked={Boolean(fieldValue)}
        onCheckedChange={(checked) => onChange(checked)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
      />
    </ToggleRow>
  );
}

export function CheckboxField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: ToggleFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);

  return (
    <ToggleRow
      id={id}
      label={label}
      description={description}
      error={error}
      className={className}
      field={name}
    >
      <Checkbox
        id={id}
        ref={inputRef}
        name={name}
        checked={Boolean(fieldValue)}
        onCheckedChange={(checked) => onChange(checked === true)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
      />
    </ToggleRow>
  );
}

/* ── Date ─────────────────────────────────────────────────────────────── */

type DateFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  min?: string;
  max?: string;
};

/** Native date input; value `YYYY-MM-DD`, empty → null. */
export function DateField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  min,
  max,
}: DateFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const value = ((fieldValue as string | null | undefined) ?? "").slice(0, 10);

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
      <Input
        id={id}
        ref={inputRef}
        name={name}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
        className="w-44"
      />
    </FieldShell>
  );
}

/* ── Color ────────────────────────────────────────────────────────────── */

const HEX = /^#[0-9A-F]{6}$/;

function normaliseHex(input: string): string {
  const text = input
    .trim()
    .toUpperCase()
    .replace(/[^#0-9A-F]/g, "");
  return text.startsWith("#") ? `#${text.slice(1).replace(/#/g, "")}` : `#${text}`;
}

/** Native colour picker + hex input; stores `#RRGGBB` (upper case). */
export function ColorField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
}: FieldBaseProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const value = (fieldValue as string | null | undefined) ?? "";
  const valid = HEX.test(value);

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
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value.toLowerCase() : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          aria-label={`${label}: colour picker`}
          className="focus-visible:ring-ring/50 h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5 outline-none focus-visible:ring-3 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          ref={inputRef}
          name={name}
          value={value}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : normaliseHex(event.target.value))
          }
          onBlur={onBlur}
          placeholder="#RRGGBB"
          maxLength={7}
          spellCheck={false}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error || (value !== "" && !valid) ? true : undefined}
          aria-describedby={describedBy(id, Boolean(description), Boolean(error))}
          className="w-28 font-mono uppercase"
        />
        {value !== "" && !valid && !error ? (
          <span className="text-muted-foreground text-xs">Use 6 hex digits, e.g. #FF4B2B</span>
        ) : null}
      </div>
    </FieldShell>
  );
}
