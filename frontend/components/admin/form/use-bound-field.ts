import { useId } from "react";
import { useController, type FieldPath, type FieldValues } from "react-hook-form";

import type { AnyControl } from "@/components/admin/form/types";

/**
 * useController, flattened. Destructuring `field` keeps the React Compiler lint from treating
 * the whole `field` object as a ref (it holds `ref`), which flags every `field.*` read.
 */
export function useBoundField<T extends FieldValues, N extends FieldPath<T>>(
  control: AnyControl<T> | undefined,
  name: N,
) {
  const {
    field: { ref: inputRef, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name });
  const id = useId();
  return { id, inputRef, value: value as unknown, onChange, onBlur, error: error?.message };
}
