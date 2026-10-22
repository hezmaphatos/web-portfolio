"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import {
  EXPERIENCE_TYPE_LABEL,
  formatPeriod,
  isExperienceType,
} from "@/components/admin/experiences/experience-schema";
import {
  KitEmpty,
  MediaThumb,
  ResourceTable,
  RowActions,
  VisibilityToggle,
  resourceColumnHelper,
} from "@/components/admin/table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { useReorderResource, useResourceList } from "@/lib/admin/resource";
import { EXPERIENCE_TYPES, type AdminExperience, type ExperienceType } from "@/lib/types";

const col = resourceColumnHelper<AdminExperience>();

const columns = col.columns([
  col.display({
    id: "logo",
    header: () => <span className="sr-only">Logo</span>,
    meta: { className: "w-14" },
    cell: ({ row }) => (
      <MediaThumb media={row.original.logo} label={row.original.organization} fit="contain" />
    ),
  }),
  col.accessor("title", {
    header: "Title",
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col">
        <span className="font-medium">{row.original.title}</span>
        {row.original.subtitle ? (
          <span className="text-muted-foreground text-xs">{row.original.subtitle}</span>
        ) : null}
      </div>
    ),
  }),
  col.accessor("organization", {
    header: "Organization",
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col">
        <span>{row.original.organization}</span>
        {row.original.location ? (
          <span className="text-muted-foreground text-xs">{row.original.location}</span>
        ) : null}
      </div>
    ),
  }),
  col.accessor("type", {
    header: "Type",
    cell: ({ row }) => <Badge variant="outline">{EXPERIENCE_TYPE_LABEL[row.original.type]}</Badge>,
  }),
  // Sorted by start date (newest first on the first click); shown as "Jan 2026 – Present".
  col.accessor("start_date", {
    id: "period",
    header: "Period",
    sortDescFirst: true,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatPeriod(row.original.start_date, row.original.end_date)}
      </span>
    ),
  }),
  col.display({
    id: "visible",
    header: "Visible",
    cell: ({ row }) => (
      <VisibilityToggle
        resource="experiences"
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
      <RowActions
        resource="experiences"
        id={row.original.id}
        label={`${row.original.title} (${row.original.organization})`}
        editHref={`/admin/experiences/${row.original.id}`}
      />
    ),
  }),
]);

type TypeFilter = ExperienceType | "all";

function searchExperience(row: AdminExperience, query: string): boolean {
  return [
    row.title,
    row.organization,
    row.location,
    row.subtitle,
    EXPERIENCE_TYPE_LABEL[row.type],
    formatPeriod(row.start_date, row.end_date),
    ...row.bullets,
  ].some((text) => text?.toLowerCase().includes(query));
}

export function ExperiencesTable() {
  const list = useResourceList<AdminExperience>("experiences");
  const reorder = useReorderResource("experiences");
  const [type, setType] = useState<TypeFilter>("all");

  const counts = useMemo(() => {
    const out = new Map<ExperienceType, number>();
    for (const row of list.data ?? []) out.set(row.type, (out.get(row.type) ?? 0) + 1);
    return out;
  }, [list.data]);

  const rows = useMemo(
    () => (type === "all" ? list.data : list.data?.filter((row) => row.type === type)),
    [list.data, type],
  );
  const filtered = type !== "all";

  return (
    <ResourceTable
      rows={rows}
      columns={columns}
      isLoading={list.isPending}
      error={list.error}
      onRetry={() => void list.refetch()}
      searchFn={searchExperience}
      searchPlaceholder="Search experiences…"
      getRowLabel={(row) => `${row.title} (${row.organization})`}
      // Reordering a filtered subset would renumber only part of the list.
      onReorder={filtered ? undefined : (ids) => reorder.mutateAsync(ids)}
      rowHref={(row) => `/admin/experiences/${row.id}`}
      caption="Experiences"
      toolbar={
        <>
          {filtered ? (
            <span className="text-muted-foreground text-xs">Show all types to reorder.</span>
          ) : null}
          <Select
            value={type}
            onValueChange={(next) => setType(isExperienceType(next) ? next : "all")}
            disabled={list.data === undefined}
          >
            <SelectTrigger size="sm" className="w-48" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types ({list.data?.length ?? 0})</SelectItem>
              {EXPERIENCE_TYPES.map((value) => (
                <SelectItem key={value} value={value} disabled={!counts.get(value)}>
                  {EXPERIENCE_TYPE_LABEL[value]} ({counts.get(value) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      emptyState={
        filtered ? (
          <KitEmpty
            title={`No ${EXPERIENCE_TYPE_LABEL[type].toLowerCase()} entries`}
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setType("all")}>
                Show all types
              </Button>
            }
          />
        ) : (
          <KitEmpty
            title="No experiences yet"
            description="Add jobs, internships, organizations and schools for the Quest Log."
            action={
              <Button asChild size="sm">
                <Link href="/admin/experiences/new">
                  <PlusIcon aria-hidden />
                  Add experience
                </Link>
              </Button>
            }
          />
        )
      }
    />
  );
}
