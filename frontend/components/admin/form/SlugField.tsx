"use client";

import { useEffect, useRef, useState } from "react";
import { useWatch, type FieldPath, type FieldValues } from "react-hook-form";
import { WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { describedBy, FieldShell } from "@/components/admin/form/FieldShell";
import { slugify } from "@/components/admin/form/slugify";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";

type SlugFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  /** Field the slug is generated from (usually "title" or "name"). */
  source: FieldPath<T>;
  /** Shown before the input, e.g. "/projects/". */
  prefix?: string;
  placeholder?: string;
};

/**
 * Kebab-case slug (same rules as Laravel `Str::slug`). While the slug is empty when the form
 * mounts (create forms) it follows the source field, until the user edits it; clearing it
 * resumes following. Existing slugs never change by themselves (URLs stay stable).
 */
export function SlugField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  source,
  prefix,
  placeholder,
}: SlugFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const sourceValue = useWatch({ control, name: source }) as unknown;
  const value = (fieldValue as string | null | undefined) ?? "";
  const generated = slugify(typeof sourceValue === "string" ? sourceValue : "");

  const [auto, setAuto] = useState(() => value === "");
  /** Last slug written by auto mode: any other non-empty value came from outside (reset). */
  const lastGenerated = useRef(value);

  useEffect(() => {
    if (!auto) return;
    if (value !== "" && value !== lastGenerated.current) {
      setAuto(false); // e.g. form.reset(loadedRow) after mount
      return;
    }
    if (value !== generated) {
      lastGenerated.current = generated;
      onChange(generated);
    }
  }, [auto, generated, value, onChange]);

  const help =
    description ??
    (auto
      ? "Generated from the title until you edit it."
      : "Lowercase letters, numbers and dashes.");

  return (
    <FieldShell
      id={id}
      label={label}
      description={help}
      error={error}
      required={required}
      className={className}
      field={name}
      aside={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled || generated === "" || generated === value}
          onClick={() => onChange(generated)}
        >
          <WandSparklesIcon aria-hidden />
          Generate from {source.split(".").pop()}
        </Button>
      }
    >
      <div className="flex items-center gap-1.5">
        {prefix ? (
          <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          ref={inputRef}
          name={name}
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            setAuto(next === "");
            lastGenerated.current = "";
            onChange(next);
          }}
          onBlur={(event) => {
            // Tidy on blur (typing "My Slug" → "my-slug") without fighting the caret mid-typing.
            const tidy = slugify(event.target.value);
            if (tidy !== value) onChange(tidy);
            onBlur();
          }}
          placeholder={placeholder ?? (generated || "my-slug")}
          spellCheck={false}
          autoCapitalize="none"
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, true, Boolean(error))}
          className="font-mono"
        />
      </div>
    </FieldShell>
  );
}
