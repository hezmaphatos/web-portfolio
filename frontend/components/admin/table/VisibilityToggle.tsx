"use client";

import { Switch } from "@/components/admin/ui/switch";
import { useToggleField, type ListResource } from "@/lib/admin/resource";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type VisibilityToggleProps = {
  resource: ListResource;
  id: number;
  /** Boolean column to flip. Default "is_visible". */
  field?: "is_visible" | "is_featured";
  value: boolean;
  /** Row name for the accessible label, e.g. "Laravel" → "Visible: Laravel". */
  label?: string;
  className?: string;
};

/** Inline switch in a table row: optimistic partial PUT `{ [field]: !value }`. */
export function VisibilityToggle({
  resource,
  id,
  field = "is_visible",
  value,
  label,
  className,
}: VisibilityToggleProps) {
  const toggle = useToggleField(resource);
  const name = field === "is_featured" ? "Featured" : "Visible";

  return (
    <Switch
      checked={value}
      onCheckedChange={(checked) => toggle.mutate({ id, field, value: checked })}
      aria-label={label ? `${name}: ${label}` : name}
      className={className}
    />
  );
}

type StatusToggleProps = {
  resource?: Extract<ListResource, "projects">;
  id: number;
  value: ProjectStatus;
  label?: string;
  className?: string;
};

/** Draft ↔ published switch for project rows (partial PUT `{ status }`; 422s are toasted). */
export function StatusToggle({
  resource = "projects",
  id,
  value,
  label,
  className,
}: StatusToggleProps) {
  const toggle = useToggleField(resource);
  const published = value === "published";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Switch
        checked={published}
        onCheckedChange={(checked) =>
          toggle.mutate({ id, field: "status", value: checked ? "published" : "draft" })
        }
        aria-label={label ? `Published: ${label}` : "Published"}
      />
      <span className={cn("text-xs", published ? "text-foreground" : "text-muted-foreground")}>
        {published ? "Published" : "Draft"}
      </span>
    </span>
  );
}
