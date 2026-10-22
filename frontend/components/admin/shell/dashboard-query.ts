import { queryOptions } from "@tanstack/react-query";

import { adminGet } from "@/lib/admin/api";
import type { Dashboard } from "@/lib/types";

/**
 * GET /admin/dashboard, shared by the Dashboard page and the sidebar's unread badge.
 * After marking messages read/unread or deleting one, invalidate `dashboardQueryKey`
 * so the badge follows.
 */
export const dashboardQueryKey = ["admin", "dashboard"] as const;

export const dashboardQueryOptions = queryOptions({
  queryKey: dashboardQueryKey,
  queryFn: () => adminGet<Dashboard>("dashboard"),
});
