"use client";

import { useId, type ReactNode } from "react";
import {
  get,
  useFieldArray,
  useFormState,
  type FieldArray,
  type FieldArrayPath,
  type FieldArrayWithId,
  type FieldError as RhfFieldError,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { FieldError } from "@/components/admin/form/FieldShell";
import type { AnyControl } from "@/components/admin/form/types";
import { cn } from "@/lib/utils";

export type RepeaterItemArgs<T extends FieldValues, N extends FieldArrayPath<T>> = {
  index: number;
  /** Path prefix of this item: build child names as `${name}.label`. */
  name: `${N}.${number}`;
  field: FieldArrayWithId<T, N>;
};

type RepeaterFieldProps<T extends FieldValues, N extends FieldArrayPath<T>> = {
  control?: AnyControl<T>;
  name: N;
  label: string;
  description?: ReactNode;
  /** One item's name for buttons / aria ("Social link"). */
  itemLabel?: string;
  /** Value appended by "Add". */
  newItem: () => FieldArray<T, N>;
  /** The item's inputs, e.g. <TextField control={control} name={`${name}.label`} label="Label" />. */
  renderItem: (args: RepeaterItemArgs<T, N>) => ReactNode;
  /** Card heading per item; default "<itemLabel> <n>". */
  itemTitle?: (index: number, field: FieldArrayWithId<T, N>) => ReactNode;
  addLabel?: string;
  maxItems?: number;
  emptyText?: ReactNode;
  disabled?: boolean;
  /** Classes for the grid that wraps each item's inputs (default 1 → 2 columns). */
  itemClassName?: string;
  className?: string;
};

function messageOf(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const error = node as RhfFieldError & { root?: RhfFieldError };
  return error.message || error.root?.message || undefined;
}

/** Array of objects (socials, stats, metrics…) with add / remove / move up / down. */
export function RepeaterField<T extends FieldValues, N extends FieldArrayPath<T>>({
  control,
  name,
  label,
  description,
  itemLabel = "Item",
  newItem,
  renderItem,
  itemTitle,
  addLabel,
  maxItems,
  emptyText = "No items yet.",
  disabled,
  itemClassName,
  className,
}: RepeaterFieldProps<T, N>) {
  const { fields, append, remove, move } = useFieldArray({ control, name });
  // An array path is always a valid field path; RHF types the two unions separately.
  const { errors } = useFormState({ control, name: name as unknown as Path<T> });
  const baseId = useId();
  const rootError = messageOf(get(errors, name));
  const full = maxItems !== undefined && fields.length >= maxItems;

  const focusLater = (elementId: string) =>
    requestAnimationFrame(() => document.getElementById(elementId)?.focus());

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-3", className)} data-field={name}>
      <legend className="mb-1.5 text-sm leading-none font-medium">{label}</legend>
      {description ? <p className="text-muted-foreground -mt-2 text-xs">{description}</p> : null}

      {fields.length === 0 ? <p className="text-muted-foreground text-sm">{emptyText}</p> : null}

      {fields.map((item, index) => {
        const title = itemTitle?.(index, item) ?? `${itemLabel} ${index + 1}`;
        return (
          <div
            key={item.id}
            className="bg-muted/30 rounded-lg border p-3"
            role="group"
            aria-label={`${itemLabel} ${index + 1}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {title}
              </p>
              <div className="flex items-center gap-0.5">
                <Button
                  id={`${baseId}-up-${index}`}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || index === 0}
                  onClick={() => {
                    move(index, index - 1);
                    focusLater(`${baseId}-up-${index - 1}`);
                  }}
                  aria-label={`Move ${itemLabel} ${index + 1} up`}
                >
                  <ChevronUpIcon aria-hidden />
                </Button>
                <Button
                  id={`${baseId}-down-${index}`}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || index === fields.length - 1}
                  onClick={() => {
                    move(index, index + 1);
                    focusLater(`${baseId}-down-${index + 1}`);
                  }}
                  aria-label={`Move ${itemLabel} ${index + 1} down`}
                >
                  <ChevronDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  onClick={() => {
                    remove(index);
                    focusLater(`${baseId}-add`);
                  }}
                  aria-label={`Remove ${itemLabel} ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </div>
            </div>
            <div className={cn("grid gap-3 sm:grid-cols-2", itemClassName)}>
              {renderItem({ index, name: `${name}.${index}` as `${N}.${number}`, field: item })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <Button
          id={`${baseId}-add`}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => append(newItem(), { shouldFocus: true })}
        >
          <PlusIcon aria-hidden />
          {addLabel ?? `Add ${itemLabel.toLowerCase()}`}
        </Button>
        {maxItems !== undefined ? (
          <span className="text-muted-foreground text-xs">
            {fields.length} / {maxItems}
          </span>
        ) : null}
      </div>
      <FieldError message={rootError} />
    </fieldset>
  );
}
