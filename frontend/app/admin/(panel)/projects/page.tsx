"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanbanIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ResourceTable } from "@/components/admin/table";
import { projectColumns } from "@/components/admin/projects/project-columns";
import { useReorderResource, useResourceList } from "@/lib/admin/resource";
import type { AdminProjectRow, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | ProjectStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

export default function ProjectsPage() {
  const list = useResourceList<AdminProjectRow>("projects");
  const reorder = useReorderResource("projects");
  const [status, setStatus] = useState<StatusFilter>("all");

  const rows = useMemo(
    () =>
      list.data && status !== "all" ? list.data.filter((row) => row.status === status) : list.data,
    [list.data, status],
  );
  const count = (value: StatusFilter) =>
    list.data
      ? value === "all"
        ? list.data.length
        : list.data.filter((row) => row.status === value).length
      : null;

  const addButton = (
    <Button asChild>
      <Link href="/admin/projects/new">
        <PlusIcon aria-hidden />
        Add project
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project is a boss on the site. Row order = showcase order (use Reorder)."
        actions={addButton}
      />
      <ResourceTable
        rows={rows}
        columns={projectColumns}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        searchKeys={["title", "slug", "category", "kind"]}
        searchPlaceholder="Search projects…"
        getRowLabel={(row) => row.title}
        // Reordering a filtered subset would scramble the hidden rows' positions.
        onReorder={status === "all" ? (ids) => reorder.mutateAsync(ids) : undefined}
        rowHref={(row) => `/admin/projects/${row.id}`}
        caption="Projects"
        toolbar={
          <div
            role="group"
            aria-label="Filter by status"
            className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5"
          >
            {FILTERS.map((filter) => {
              const active = status === filter.value;
              const n = count(filter.value);
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(filter.value)}
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-md px-2.5 py-1 text-sm font-medium outline-none focus-visible:ring-2",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  {n !== null ? (
                    <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{n}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        }
        emptyState={
          status === "all" ? (
            <EmptyState
              icon={FolderKanbanIcon}
              title="No projects yet"
              description="Add your first project: it becomes a boss on the site."
              action={addButton}
              compact
            />
          ) : (
            <EmptyState
              icon={FolderKanbanIcon}
              title={status === "draft" ? "No drafts" : "Nothing published yet"}
              action={
                <Button type="button" variant="outline" onClick={() => setStatus("all")}>
                  Show all projects
                </Button>
              }
              compact
            />
          )
        }
      />
    </>
  );
}
