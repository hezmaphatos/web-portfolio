import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

/**
 * A form's `control`, whatever its resolver output type.
 * `any` ×2: the context type and the transformed (zod output) type are irrelevant to a field,
 * and `Control` is invariant in them, so `Control<In, unknown, Out>` would not be assignable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyControl<T extends FieldValues> = Control<T, any, any>;

/** Props every bound field takes. `control` may be omitted inside a <FormProvider>. */
export type FieldBaseProps<T extends FieldValues, N extends FieldPath<T>> = {
  control?: AnyControl<T>;
  name: N;
  label: string;
  /** Help text under the input. */
  description?: ReactNode;
  /** Shows a required marker and sets aria-required (validation stays in the schema/API). */
  required?: boolean;
  disabled?: boolean;
  className?: string;
};
