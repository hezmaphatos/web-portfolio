import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { adminRequest, adminSend, ApiError, errorMessage } from "@/lib/admin/api";
import { adminKeys } from "@/lib/admin/resource";
import type { AdminSite } from "@/lib/types";

/** The single site_settings record (GET|PUT /admin/site). */
export const siteQueryKey = ["admin", "site"] as const;

export const siteQueryOptions = queryOptions({
  queryKey: siteQueryKey,
  queryFn: async ({ signal }) => (await adminRequest<{ data: AdminSite }>("site", { signal })).data,
});

/**
 * PUT /admin/site with every editable field (full_name and nickname are always required).
 * Resolves with the saved record. 422s are re-thrown for `applyServerErrors`.
 */
export function useSaveSite() {
  const queryClient = useQueryClient();

  return useMutation<AdminSite, unknown, Record<string, unknown>>({
    mutationFn: (values) => adminSend<AdminSite>("PUT", "site", values),
    onSuccess: (site) => {
      queryClient.setQueryData(siteQueryKey, site);
      // Media `used_in` lists change when the avatar/portrait/CV/OG image changes.
      void queryClient.invalidateQueries({ queryKey: adminKeys.media });
      toast.success("Profile & site saved");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        toast.error("Please fix the highlighted fields.", { description: error.message });
      } else {
        toast.error(`Could not save: ${errorMessage(error)}`);
      }
    },
  });
}
