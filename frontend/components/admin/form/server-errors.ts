import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";

import { focusField } from "@/components/admin/form/focus-field";
import { firstErrors } from "@/lib/admin/api";

/**
 * Maps an API 422 (`errors: { "metrics.0.value": ["…"] }`) onto react-hook-form with `setError`.
 * Laravel's dot paths are the same as RHF paths, so nested errors land on their fields.
 * Then focuses the first errored control (by its `data-field`, so list items, repeater rows and
 * media pickers work too). Returns true when anything was mapped.
 *
 * @example
 * save.mutate({ id, values }, { onError: (error) => applyServerErrors(form, error) });
 */
export function applyServerErrors<T extends FieldValues>(
  form: { setError: UseFormSetError<T> },
  error: unknown,
  options: { focus?: boolean } = {},
): boolean {
  const entries = Object.entries(firstErrors(error));
  for (const [path, message] of entries) {
    form.setError(path as FieldPath<T>, { type: "server", message });
  }
  if (entries.length > 0 && (options.focus ?? true) && typeof window !== "undefined") {
    // After React renders the messages; a field on a hidden tab is skipped silently.
    requestAnimationFrame(() => {
      for (const [path] of entries) if (focusField(path)) break;
    });
  }
  return entries.length > 0;
}
