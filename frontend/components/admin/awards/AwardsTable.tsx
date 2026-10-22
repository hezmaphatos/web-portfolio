"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { PLACEMENT_LABEL, PlacementBadge } from "@/components/admin/awards/PlacementBadge";
import {
  KitEmpty,
  MediaThumb,
  ResourceTable,
  RowActions,
  VisibilityToggle,
  resourceColumnHelper,
} from "@/components/admin/table";
import { Button } from "@/components/admin/ui/button";
import { useReorderResource, useResourceList } from "@/lib/admin/resource";
import { AWARD_PLACEMENTS, type AdminAward } from "@/lib/types";

/** Titles repeat ("Participant"), so names in buttons and drag announcements add the event. */
function awardLabel(row: AdminAward): string {
  return `${row.title} (${row.event})`;
}

const col = resourceColumnHelper<AdminAward>();

const columns = col.columns([
  col.display({
    id: "image",
    header: () => <span className="sr-only">Certificate</span>,
    meta: { className: "w-14" },
    cell: ({ row }) => <MediaThumb media={row.original.image} label={row.original.title} />,
  }),
  col.accessor("title", {
    header: "Title",
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col">
        <span className="font-medium">{row.original.title}</span>
        <span className="text-muted-foreground text-xs">
          {[row.original.event, row.original.issuer].filter(Boolean).join(" · ")}
        </span>
      </div>
    ),
  }),
  col.accessor((row) => row.year ?? undefined, {
    id: "year",
    header: "Year",
    sortUndefined: "last",
    sortDescFirst: true,
    meta: { align: "end", className: "tabular-nums" },
    cell: ({ row }) => row.original.year ?? <span className="text-muted-foreground">—</span>,
  }),
  // Sorted by rank (gold first), not alphabetically.
  col.accessor((row) => AWARD_PLACEMENTS.indexOf(row.placement), {
    id: "placement",
    header: "Placement",
    cell: ({ row }) => <PlacementBadge placement={row.original.placement} />,
  }),
  col.accessor((row) => row.category ?? undefined, {
    id: "category",
    header: "Category",
    sortUndefined: "last",
    cell: ({ row }) => row.original.category ?? <span className="text-muted-foreground">—</span>,
  }),
  col.display({
    id: "visible",
    header: "Visible",
    cell: ({ row }) => (
      <VisibilityToggle
        resource="awards"
        id={row.original.id}
        value={row.original.is_visible}
        label={awardLabel(row.original)}
      />
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <RowActions
        resource="awards"
        id={row.original.id}
        label={awardLabel(row.original)}
        editHref={`/admin/awards/${row.original.id}`}
      />
    ),
  }),
]);

function searchAward(row: AdminAward, query: string): boolean {
  return [
    row.title,
    row.event,
    row.issuer,
    row.category,
    row.year === null ? null : String(row.year),
    PLACEMENT_LABEL[row.placement],
  ].some((text) => text?.toLowerCase().includes(query));
}

export function AwardsTable() {
  const list = useResourceList<AdminAward>("awards");
  const reorder = useReorderResource("awards");

  return (
    <ResourceTable
      rows={list.data}
      columns={columns}
      isLoading={list.isPending}
      error={list.error}
      onRetry={() => void list.refetch()}
      searchFn={searchAward}
      searchPlaceholder="Search awards…"
      getRowLabel={awardLabel}
      onReorder={(ids) => reorder.mutateAsync(ids)}
      rowHref={(row) => `/admin/awards/${row.id}`}
      caption="Awards"
      emptyState={
        <KitEmpty
          title="No awards yet"
          description="Add medals, finalist spots and participations for the Trophy Room."
          action={
            <Button asChild size="sm">
              <Link href="/admin/awards/new">
                <PlusIcon aria-hidden />
                Add award
              </Link>
            </Button>
          }
        />
      }
    />
  );
}
