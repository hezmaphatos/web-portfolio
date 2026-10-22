/**
 * TanStack Query hooks for the admin list resources (experiences, skills, projects, awards,
 * sections). Every request goes through the BFF client in `lib/admin/api.ts`.
 *
 * Query keys: `["admin", resource]` for the full list, `["admin", resource, id]` for one row.
 * The list key is a prefix of the item keys, so invalidating `["admin", resource]` (non-exact)
 * refreshes both.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { adminRequest, adminSend, ApiError, errorMessage } from "@/lib/admin/api";
import type { ReorderItem } from "@/lib/types";

export type ListResource = "experiences" | "skills" | "projects" | "awards" | "sections";
/** Sections have a fixed order (no reorder endpoint). */
export type ReorderableResource = Exclude<ListResource, "sections">;
/** Fields the tables flip inline with a partial PUT. */
export type ToggleField = "is_visible" | "status" | "is_featured";

type WithId = { id: number };

export const adminKeys = {
  all: ["admin"] as const,
  list: (resource: ListResource) => ["admin", resource] as const,
  item: (resource: ListResource, id: number) => ["admin", resource, id] as const,
  /** Used by the dashboard page; refreshed after creates/deletes change the counts. */
  dashboard: ["admin", "dashboard"] as const,
  /** Media list/detail live under this prefix (see components/admin/media/media-queries.ts). */
  media: ["admin", "media"] as const,
};

const RESOURCE_LABEL: Record<ListResource, string> = {
  experiences: "Experience",
  skills: "Skill",
  projects: "Project",
  awards: "Award",
  sections: "Section",
};

/** Full list (the API does not paginate these). */
export function useResourceList<T>(resource: ListResource) {
  return useQuery({
    queryKey: adminKeys.list(resource),
    queryFn: async ({ signal }) => {
      const res = await adminRequest<{ data: T[] }>(resource, { signal });
      return res.data;
    },
  });
}

/** One row (the `show` shape). Disabled while `id` is null (create forms). */
export function useResourceItem<T>(resource: ListResource, id: number | null) {
  return useQuery({
    queryKey: id === null ? ["admin", resource, "none"] : adminKeys.item(resource, id),
    queryFn: async ({ signal }) => {
      const res = await adminRequest<{ data: T }>(`${resource}/${id}`, { signal });
      return res.data;
    },
    enabled: id !== null,
  });
}

export type SaveVariables = {
  /** Omit / null → POST (create); a number → PUT /{id} (partial update). */
  id?: number | null;
  values: Record<string, unknown>;
};

export type SaveOptions = {
  /** Success toast text; `false` disables it. Defaults to "<Resource> created/saved". */
  successMessage?: string | false;
};

/**
 * Create or update. Resolves with the saved row (the API's `show` shape).
 * 422 errors are re-thrown untouched: map them onto the form with `applyServerErrors`.
 */
export function useSaveResource<T extends WithId>(resource: ListResource, options?: SaveOptions) {
  const queryClient = useQueryClient();

  return useMutation<T, unknown, SaveVariables>({
    mutationFn: ({ id, values }) =>
      id == null
        ? adminSend<T>("POST", resource, values)
        : adminSend<T>("PUT", `${resource}/${id}`, values),
    onSuccess: (row, { id }) => {
      queryClient.setQueryData(adminKeys.item(resource, row.id), row);
      void queryClient.invalidateQueries({ queryKey: adminKeys.list(resource), exact: true });
      // Media `used_in` lists change when a row starts/stops referencing a file.
      void queryClient.invalidateQueries({ queryKey: adminKeys.media });
      if (id == null) void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });

      if (options?.successMessage !== false) {
        const label = RESOURCE_LABEL[resource];
        toast.success(
          options?.successMessage ?? (id == null ? `${label} created` : `${label} saved`),
        );
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        toast.error("Please fix the highlighted fields.", { description: error.message });
      } else {
        toast.error(errorMessage(error));
      }
    },
  });
}

/** Delete by id. 409 (e.g. "still in use") messages are shown as an error toast. */
export function useDeleteResource(resource: ListResource) {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, number>({
    mutationFn: (id) => adminSend("DELETE", `${resource}/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<WithId[]>(adminKeys.list(resource), (rows) =>
        rows?.filter((row) => row.id !== id),
      );
      queryClient.removeQueries({ queryKey: adminKeys.item(resource, id), exact: true });
      void queryClient.invalidateQueries({ queryKey: adminKeys.list(resource), exact: true });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: adminKeys.media });
      toast.success(`${RESOURCE_LABEL[resource]} deleted`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.status === 409
          ? error.message
          : `Could not delete: ${errorMessage(error)}`,
      );
    },
  });
}

type ListSnapshot = { previous: WithId[] | undefined };

async function snapshotList(queryClient: QueryClient, resource: ListResource) {
  await queryClient.cancelQueries({ queryKey: adminKeys.list(resource), exact: true });
  return queryClient.getQueryData<WithId[]>(adminKeys.list(resource));
}

/**
 * Save a new order. Pass every id of the list in the new order; `sort_order` = index.
 * The cached list is reordered optimistically and rolled back on failure.
 */
export function useReorderResource(resource: ReorderableResource) {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, number[], ListSnapshot>({
    mutationFn: (orderedIds) => {
      const items: ReorderItem[] = orderedIds.map((id, index) => ({ id, sort_order: index }));
      return adminSend("POST", `${resource}/reorder`, { items });
    },
    onMutate: async (orderedIds) => {
      const previous = await snapshotList(queryClient, resource);
      if (previous) {
        const position = new Map(orderedIds.map((id, index) => [id, index]));
        const next = [...previous]
          .sort(
            (a, b) =>
              (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (position.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          )
          .map((row) =>
            position.has(row.id) ? { ...row, sort_order: position.get(row.id) } : row,
          );
        queryClient.setQueryData(adminKeys.list(resource), next);
      }
      return { previous };
    },
    onError: (error, _ids, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(adminKeys.list(resource), snapshot.previous);
      toast.error(`Could not save the order: ${errorMessage(error)}`);
    },
    onSuccess: () => {
      toast.success("Order saved");
    },
    onSettled: () => {
      // Non-exact: item caches carry sort_order too.
      void queryClient.invalidateQueries({ queryKey: adminKeys.list(resource) });
    },
  });
}

export type ToggleVariables = {
  id: number;
  field: ToggleField;
  /** boolean for is_visible / is_featured, "draft" | "published" for status. */
  value: boolean | string;
};

/**
 * Flip one field from a table row with a partial `PUT {[field]: value}`.
 * Optimistic on both the list row and the cached item; rolled back on failure.
 */
export function useToggleField(resource: ListResource) {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, ToggleVariables, ListSnapshot & { previousItem: unknown }>({
    mutationFn: ({ id, field, value }) => adminSend("PUT", `${resource}/${id}`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      const previous = await snapshotList(queryClient, resource);
      const itemKey = adminKeys.item(resource, id);
      await queryClient.cancelQueries({ queryKey: itemKey, exact: true });
      const previousItem = queryClient.getQueryData(itemKey);

      queryClient.setQueryData<WithId[]>(adminKeys.list(resource), (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      );
      if (previousItem && typeof previousItem === "object") {
        queryClient.setQueryData(itemKey, { ...previousItem, [field]: value });
      }
      return { previous, previousItem };
    },
    onError: (error, { id }, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(adminKeys.list(resource), snapshot.previous);
      if (snapshot?.previousItem) {
        queryClient.setQueryData(adminKeys.item(resource, id), snapshot.previousItem);
      }
      toast.error(`Could not update: ${errorMessage(error)}`);
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.list(resource), exact: true });
      void queryClient.invalidateQueries({ queryKey: adminKeys.item(resource, id), exact: true });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
}
