import { EyeIcon } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import {
  MediaThumb,
  resourceColumnHelper,
  RowActions,
  StatusToggle,
  VisibilityToggle,
} from "@/components/admin/table";
import { BOSS_TIER_LABEL, previewHref } from "@/components/admin/projects/project-form";
import type { AdminProjectRow, ProjectCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  web: "Web",
  mobile: "Mobile",
  ml: "ML",
  game: "Game",
  other: "Other",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (withTime ? dateTimeFormat : dateFormat).format(date);
}

const col = resourceColumnHelper<AdminProjectRow>();

/** Project list columns (module scope so the table keeps a stable reference). */
export const projectColumns = col.columns([
  col.display({
    id: "cover",
    header: () => <span className="sr-only">Cover</span>,
    meta: { className: "w-14" },
    cell: ({ row }) => (
      <span
        className="inline-flex rounded-md border-b-4"
        style={{ borderBottomColor: row.original.accent_color }}
      >
        <MediaThumb media={row.original.cover} label={row.original.title} />
      </span>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    meta: { className: "min-w-44 max-w-64" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium" title={row.original.title}>
          {row.original.title}
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs">
          /projects/{row.original.slug}
        </span>
      </div>
    ),
  }),
  col.accessor("status", {
    header: "Status",
    cell: ({ row }) => (
      <StatusToggle id={row.original.id} value={row.original.status} label={row.original.title} />
    ),
  }),
  col.accessor("category", {
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="font-normal">
        {CATEGORY_LABEL[row.original.category] ?? row.original.category}
      </Badge>
    ),
  }),
  col.accessor("is_featured", {
    header: "Featured",
    sortDescFirst: true,
    cell: ({ row }) => (
      <VisibilityToggle
        resource="projects"
        id={row.original.id}
        field="is_featured"
        value={row.original.is_featured}
        label={row.original.title}
      />
    ),
  }),
  col.accessor((r) => (r.boss_enabled ? r.boss_hp : undefined), {
    id: "boss",
    header: "Boss",
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.boss_enabled ? (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <Badge
              variant={row.original.boss_tier === "final" ? "default" : "secondary"}
              className={cn(
                row.original.boss_tier === "minion" && "bg-muted text-muted-foreground",
              )}
            >
              {BOSS_TIER_LABEL[row.original.boss_tier]}
            </Badge>
            <span className="text-xs tabular-nums">{row.original.boss_hp} HP</span>
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {row.original.defeat_count.toLocaleString("en-US")}{" "}
            {row.original.defeat_count === 1 ? "defeat" : "defeats"}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">No boss</span>
      ),
  }),
  col.accessor("skills_count", {
    header: "Content",
    sortDescFirst: true,
    meta: { className: "whitespace-nowrap text-xs tabular-nums" },
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span>
          {row.original.skills_count} {row.original.skills_count === 1 ? "skill" : "skills"}
        </span>
        <span className="text-muted-foreground">
          {row.original.gallery_count} {row.original.gallery_count === 1 ? "image" : "images"}
        </span>
      </div>
    ),
  }),
  col.accessor("view_count", {
    header: "Views",
    sortDescFirst: true,
    meta: { align: "end", className: "tabular-nums" },
    cell: ({ row }) => row.original.view_count.toLocaleString("en-US"),
  }),
  col.accessor("updated_at", {
    header: "Updated",
    sortDescFirst: true,
    meta: { className: "whitespace-nowrap text-muted-foreground text-xs" },
    cell: ({ row }) => (
      <time dateTime={row.original.updated_at} title={formatDate(row.original.updated_at, true)}>
        {formatDate(row.original.updated_at)}
      </time>
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <RowActions
        resource="projects"
        id={row.original.id}
        label={row.original.title}
        editHref={`/admin/projects/${row.original.id}`}
        deleteDescription="It leaves the site right away; its media stays in the Media Library."
      >
        <a
          href={previewHref(row.original.slug)}
          target="_blank"
          rel="noopener"
          title={`Preview ${row.original.title}`}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          <EyeIcon className="size-3.5" aria-hidden />
          <span className="sr-only">Preview {row.original.title} (new tab)</span>
        </a>
      </RowActions>
    ),
  }),
]);
