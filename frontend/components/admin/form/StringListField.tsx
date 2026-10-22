"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import {
  get,
  useController,
  useFormState,
  type FieldError as RhfFieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { FieldError } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { cn } from "@/lib/utils";

type StringListFieldProps<T extends FieldValues, N extends FieldPath<T>> = Omit<
  FieldBaseProps<T, N>,
  "required"
> & {
  /** Label of one item, used in aria labels ("Bullet 2"). Default: the label. */
  itemLabel?: string;
  addLabel?: string;
  placeholder?: string;
  maxItems?: number;
  emptyText?: ReactNode;
};

/** Message of an RHF error node (leaf, array root or `.root`). */
function messageOf(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const error = node as RhfFieldError & { root?: RhfFieldError };
  return error.message || error.root?.message || undefined;
}

/**
 * `string[]` repeater (roles, bullets, highlights, challenges): add / remove / move up / down.
 * Enter in an item adds a new item below. Errors like "bullets.2" show under that item.
 */
export function StringListField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  itemLabel,
  addLabel = "Add item",
  placeholder,
  maxItems,
  emptyText = "No items yet.",
}: StringListFieldProps<T, N>) {
  const { field } = useController({ control, name });
  const { errors } = useFormState({ control, name });
  const baseId = useId();
  const items: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
  const one = itemLabel ?? label;
  const rootError = messageOf(get(errors, name));
  const full = maxItems !== undefined && items.length >= maxItems;

  const inputId = (index: number) => `${baseId}-item-${index}`;
  const focusLater = (elementId: string) =>
    requestAnimationFrame(() => document.getElementById(elementId)?.focus());

  function update(next: string[]) {
    field.onChange(next);
  }

  function insert(at: number) {
    if (full) return;
    const next = [...items];
    next.splice(at, 0, "");
    update(next);
    focusLater(inputId(at));
  }

  function remove(index: number) {
    update(items.filter((_, i) => i !== index));
    focusLater(items.length > 1 ? inputId(Math.max(0, index - 1)) : `${baseId}-add`);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
    focusLater(`${baseId}-${to > from ? "down" : "up"}-${to}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault(); // never submit the form from a list item
      insert(index + 1);
    } else if (event.key === "Backspace" && items[index] === "" && items.length > 0) {
      event.preventDefault();
      remove(index);
    }
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)} data-field={name}>
      <legend className="mb-1.5 text-sm leading-none font-medium">{label}</legend>
      {description ? (
        <p id={`${baseId}-description`} className="text-muted-foreground -mt-1 text-xs">
          {description}
        </p>
      ) : null}

      {items.length === 0 ? <p className="text-muted-foreground text-sm">{emptyText}</p> : null}

      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const itemError = messageOf(get(errors, `${name}.${index}`));
          const errorId = `${inputId(index)}-error`;
          return (
            // Index keys are fine: inputs are controlled and focus is moved explicitly.
            <li key={index} className="flex flex-col gap-1" data-field={`${name}.${index}`}>
              <div className="flex items-center gap-1">
                <Label htmlFor={inputId(index)} className="sr-only">
                  {one} {index + 1}
                </Label>
                <span
                  className="text-muted-foreground w-5 text-right text-xs tabular-nums"
                  aria-hidden
                >
                  {index + 1}.
                </span>
                <Input
                  id={inputId(index)}
                  ref={index === 0 ? field.ref : undefined}
                  name={`${name}.${index}`}
                  value={item ?? ""}
                  onChange={(event) =>
                    update(items.map((value, i) => (i === index ? event.target.value : value)))
                  }
                  onBlur={field.onBlur}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  placeholder={placeholder}
                  disabled={disabled}
                  aria-invalid={itemError ? true : undefined}
                  aria-describedby={itemError ? errorId : undefined}
                />
                <Button
                  id={`${baseId}-up-${index}`}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Move ${one} ${index + 1} up`}
                >
                  <ChevronUpIcon aria-hidden />
                </Button>
                <Button
                  id={`${baseId}-down-${index}`}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Move ${one} ${index + 1} down`}
                >
                  <ChevronDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label={`Remove ${one} ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
              <div className="pl-6">
                <FieldError id={errorId} message={itemError} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2">
        <Button
          id={`${baseId}-add`}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => insert(items.length)}
        >
          <PlusIcon aria-hidden />
          {addLabel}
        </Button>
        {maxItems !== undefined ? (
          <span className="text-muted-foreground text-xs">
            {items.length} / {maxItems}
          </span>
        ) : null}
      </div>
      <FieldError message={rootError} />
    </fieldset>
  );
}
