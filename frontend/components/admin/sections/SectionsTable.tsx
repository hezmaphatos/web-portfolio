"use client";

import { PanelsTopLeftIcon } from "lucide-react";

import { chapterInfo } from "@/components/admin/sections/chapters";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import {
  ResourceTable,
  resourceColumnHelper,
  RowActions,
  VisibilityToggle,
} from "@/components/admin/table";
import { Badge } from "@/components/admin/ui/badge";
import { useResourceList } from "@/lib/admin/resource";
import type { AdminSection } from "@/lib/types";

const col = resourceColumnHelper<AdminSection>();

// The chapter order is fixed (spec §4.1), so no column sorts: the table always shows API order.
const columns = col.columns([
  col.accessor("sort_order", {
    header: () => (
      <>
        <span aria-hidden>#</span>
        <span className="sr-only">Chapter number</span>
      </>
    ),
    enableSorting: false,
    meta: { className: "text-muted-foreground w-10 font-mono tabular-nums" },
  }),
  col.accessor("key", {
    header: "Chapter",
    enableSorting: false,
    meta: { className: "min-w-44 max-w-64 whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <code className="bg-muted w-fit rounded px-1.5 py-0.5 font-mono text-xs">
          {row.original.key}
        </code>
        <span className="text-muted-foreground text-xs">
          {chapterInfo(row.original.key)?.summary}
        </span>
      </div>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    enableSorting: false,
    meta: { className: "font-medium" },
  }),
  col.accessor("subtitle", {
    header: "Subtitle",
    enableSorting: false,
    meta: { className: "max-w-48 whitespace-normal" },
    cell: ({ getValue }) =>
      getValue() ?? (
        <span className="text-muted-foreground" aria-label="No subtitle">
          —
        </span>
      ),
  }),
  col.accessor("hint", {
    header: "Stage hint",
    enableSorting: false,
    meta: { className: "min-w-56 max-w-md whitespace-normal" },
    cell: ({ getValue }) => {
      const hint = getValue();
      return hint ? (
        <p className="text-muted-foreground line-clamp-2 text-sm" title={hint}>
          {hint}
        </p>
      ) : (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          No hint yet
        </Badge>
      );
    },
  }),
  col.display({
    id: "visible",
    header: "Visible",
    cell: ({ row }) => (
      <VisibilityToggle
        resource="sections"
        id={row.original.id}
        value={row.original.is_visible}
        label={row.original.title}
      />
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <RowActions label={row.original.title} editHref={`/admin/sections/${row.original.id}`} />
    ),
  }),
]);

/** The eight fixed chapters in API (= home page) order: no create, delete or reorder. */
export function SectionsTable() {
  const list = useResourceList<AdminSection>("sections");

  return (
    <ResourceTable
      rows={list.data}
      columns={columns}
      isLoading={list.isPending}
      error={list.error}
      onRetry={() => void list.refetch()}
      getRowLabel={(row) => row.title}
      rowHref={(row) => `/admin/sections/${row.id}`}
      caption="Home-page chapters"
      emptyState={
        <EmptyState
          compact
          icon={PanelsTopLeftIcon}
          title="No sections found"
          description="The eight chapters are created by the database seeder: run php artisan db:seed --class=SectionSeeder in backend/."
        />
      }
    />
  );
}
