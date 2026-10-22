"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import {
  ResourceTable,
  RowActions,
  VisibilityToggle,
  KitEmpty,
  resourceColumnHelper,
} from "@/components/admin/table";
import { DpsWarningBadge, LevelPips, SkillIcon } from "@/components/admin/skills/skill-bits";
import { CATEGORY_LABEL, formatSeconds, SOFT } from "@/components/admin/skills/skill-schema";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { useReorderResource, useResourceList } from "@/lib/admin/resource";
import { SKILL_CATEGORIES, type AdminSkill, type SkillCategory } from "@/lib/types";

const col = resourceColumnHelper<AdminSkill>();

const NONE = <span className="text-muted-foreground">—</span>;

const columns = col.columns([
  col.display({
    id: "icon",
    header: () => <span className="sr-only">Icon</span>,
    meta: { className: "w-12" },
    cell: ({ row }) => (
      <SkillIcon
        icon={row.original.icon}
        iconKey={row.original.icon_key}
        name={row.original.name}
      />
    ),
  }),
  col.accessor("name", {
    header: "Name",
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/admin/skills/${row.original.id}`}
          className="focus-visible:ring-ring/50 w-fit rounded font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {row.original.name}
        </Link>
        <span className="text-muted-foreground font-mono text-xs">{row.original.slug}</span>
      </div>
    ),
  }),
  col.accessor("category", {
    header: "Category",
    cell: ({ row }) => (
      <Badge variant={row.original.category === SOFT ? "secondary" : "outline"}>
        {CATEGORY_LABEL[row.original.category]}
      </Badge>
    ),
  }),
  col.accessor("level", {
    header: "Level",
    sortDescFirst: true,
    cell: ({ row }) => <LevelPips level={row.original.level} />,
  }),
  col.accessor("status", {
    header: "Status",
    cell: ({ row }) =>
      row.original.status === "core" ? (
        <Badge variant="secondary">Core</Badge>
      ) : (
        <Badge variant="outline" className="border-dashed">
          Learning
        </Badge>
      ),
  }),
  col.accessor((row) => row.attack_name ?? undefined, {
    id: "attack",
    header: "Attack",
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.category === SOFT ? (
        <span className="text-muted-foreground text-xs">Not a game skill</span>
      ) : (
        (row.original.attack_name ?? NONE)
      ),
  }),
  col.accessor((row) => row.damage ?? undefined, {
    id: "damage",
    header: () => (
      <abbr title="Damage" className="no-underline">
        DMG
      </abbr>
    ),
    sortUndefined: "last",
    sortDescFirst: true,
    meta: { align: "end", className: "tabular-nums" },
    cell: ({ row }) => row.original.damage ?? NONE,
  }),
  col.accessor((row) => row.cooldown_ms ?? undefined, {
    id: "cooldown",
    header: () => (
      <abbr title="Cooldown in seconds" className="no-underline">
        CD (s)
      </abbr>
    ),
    sortUndefined: "last",
    meta: { align: "end", className: "tabular-nums" },
    cell: ({ row }) =>
      row.original.cooldown_ms === null ? NONE : formatSeconds(row.original.cooldown_ms),
  }),
  col.accessor((row) => row.dps ?? undefined, {
    id: "dps",
    header: () => (
      <abbr title="Damage per second (damage ÷ cooldown)" className="no-underline">
        DPS
      </abbr>
    ),
    sortUndefined: "last",
    sortDescFirst: true,
    meta: { align: "end", className: "tabular-nums" },
    cell: ({ row }) =>
      row.original.dps === null ? (
        NONE
      ) : (
        <span className="inline-flex items-center justify-end gap-2">
          <DpsWarningBadge warning={row.original.dps_warning} />
          {row.original.dps.toFixed(1)}
        </span>
      ),
  }),
  col.accessor("projects_count", {
    header: "Projects",
    sortDescFirst: true,
    meta: { align: "end", className: "tabular-nums" },
  }),
  col.display({
    id: "visible",
    header: "Visible",
    cell: ({ row }) => (
      <VisibilityToggle
        resource="skills"
        id={row.original.id}
        value={row.original.is_visible}
        label={row.original.name}
      />
    ),
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <RowActions
        resource="skills"
        id={row.original.id}
        label={row.original.name}
        editHref={`/admin/skills/${row.original.id}`}
        deleteDescription={
          row.original.projects_count > 0
            ? `It is removed from ${row.original.projects_count} ${
                row.original.projects_count === 1 ? "project" : "projects"
              }.`
            : undefined
        }
      />
    ),
  }),
]);

type SpecialFilter = "all" | "game" | "warnings";
type CategoryFilter = SkillCategory | SpecialFilter;

const SPECIAL_FILTERS: readonly SpecialFilter[] = ["all", "game", "warnings"];

const FILTER_LABEL: Record<SpecialFilter, string> = {
  all: "All categories",
  game: "All game skills",
  warnings: "DPS warnings",
};

function isSpecial(filter: CategoryFilter): filter is SpecialFilter {
  return (SPECIAL_FILTERS as readonly string[]).includes(filter);
}

function matchesFilter(row: AdminSkill, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "game") return row.category !== SOFT;
  if (filter === "warnings") return row.dps_warning !== null;
  return row.category === filter;
}

function searchSkill(row: AdminSkill, query: string): boolean {
  return [row.name, row.slug, row.attack_name, row.icon_key, CATEGORY_LABEL[row.category]].some(
    (text) => text?.toLowerCase().includes(query),
  );
}

/**
 * Puts the reordered subset back into the full list: the filtered rows swap places among the
 * slots they already occupy, every other row keeps its position.
 */
function mergeOrder(all: readonly AdminSkill[], subset: readonly number[]): number[] {
  const members = new Set(subset);
  let next = 0;
  return all.map((row) => (members.has(row.id) ? (subset[next++] ?? row.id) : row.id));
}

export function SkillsTable() {
  const list = useResourceList<AdminSkill>("skills");
  const reorder = useReorderResource("skills");
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const all = list.data;
  const rows = useMemo(
    () => (all && filter !== "all" ? all.filter((row) => matchesFilter(row, filter)) : all),
    [all, filter],
  );

  const counts = useMemo(() => {
    const out = new Map<CategoryFilter, number>();
    for (const row of all ?? []) out.set(row.category, (out.get(row.category) ?? 0) + 1);
    out.set("all", all?.length ?? 0);
    out.set("game", (all?.length ?? 0) - (out.get(SOFT) ?? 0));
    out.set("warnings", all?.filter((row) => row.dps_warning !== null).length ?? 0);
    return out;
  }, [all]);

  const filterLabel = isSpecial(filter) ? FILTER_LABEL[filter] : CATEGORY_LABEL[filter];
  /** " (12)" once the list is loaded. */
  const count = (value: CategoryFilter) => (all ? ` (${counts.get(value) ?? 0})` : "");

  const toolbar = (
    <div className="flex items-center gap-2">
      <Label htmlFor="skills-category-filter" className="text-muted-foreground text-sm font-normal">
        Category
      </Label>
      <Select
        value={filter}
        onValueChange={(value) => setFilter(value as CategoryFilter)}
        disabled={!all}
      >
        <SelectTrigger id="skills-category-filter" size="sm" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPECIAL_FILTERS.map((value) => (
            <SelectItem key={value} value={value}>
              {FILTER_LABEL[value]}
              {count(value)}
            </SelectItem>
          ))}
          <SelectSeparator />
          {SKILL_CATEGORIES.map((value) => (
            <SelectItem key={value} value={value}>
              {CATEGORY_LABEL[value]}
              {count(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const emptyState =
    filter === "all" ? (
      <KitEmpty
        title="No skills yet"
        description="Add the tech you use; game skills get an attack, damage and cooldown for the boss battles."
        action={
          <Button asChild size="sm">
            <Link href="/admin/skills/new">
              <PlusIcon aria-hidden />
              Add skill
            </Link>
          </Button>
        }
      />
    ) : (
      <KitEmpty
        title={
          filter === "warnings"
            ? "Every game skill is inside the DPS guideline"
            : `No skills in “${filterLabel}”`
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setFilter("all")}>
            Show all categories
          </Button>
        }
      />
    );

  return (
    <ResourceTable
      rows={rows}
      columns={columns}
      isLoading={list.isPending}
      error={list.error}
      onRetry={() => void list.refetch()}
      searchFn={searchSkill}
      searchPlaceholder="Search skills…"
      getRowLabel={(row) => row.name}
      onReorder={(ids) => reorder.mutateAsync(all ? mergeOrder(all, ids) : ids)}
      rowHref={(row) => `/admin/skills/${row.id}`}
      toolbar={toolbar}
      emptyState={emptyState}
      pageSize={50}
      caption={filter === "all" ? "Skills" : `Skills: ${filterLabel}`}
    />
  );
}
