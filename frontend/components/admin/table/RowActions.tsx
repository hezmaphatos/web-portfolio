"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import { KitSpinner } from "@/components/admin/table/states";
import { useDeleteResource, type ListResource } from "@/lib/admin/resource";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  /** Edit page; renders a pencil link. */
  editHref?: string;
  /** With `id`: enables Delete (confirm dialog → DELETE /{resource}/{id}). */
  resource?: ListResource;
  id?: number;
  /** Row name used in labels and the confirm text, e.g. the project title. */
  label: string;
  /** Called after a successful delete. */
  onDelete?: () => void;
  /** Extra confirm text (consequences), e.g. "It is removed from 3 projects." */
  deleteDescription?: ReactNode;
  /** Extra buttons rendered before Edit. */
  children?: ReactNode;
  className?: string;
};

/** Edit link + Delete-with-confirmation for a table row. */
export function RowActions({
  editHref,
  resource,
  id,
  label,
  onDelete,
  deleteDescription,
  children,
  className,
}: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const canDelete = resource !== undefined && resource !== "sections" && id !== undefined;

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {children}
      {editHref ? (
        <Button asChild variant="ghost" size="icon-sm" title={`Edit ${label}`}>
          <Link href={editHref}>
            <PencilIcon aria-hidden />
            <span className="sr-only">Edit {label}</span>
          </Link>
        </Button>
      ) : null}
      {canDelete ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={`Delete ${label}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setOpen(true)}
          >
            <Trash2Icon aria-hidden />
            <span className="sr-only">Delete {label}</span>
          </Button>
          <DeleteDialog
            open={open}
            onOpenChange={setOpen}
            resource={resource}
            id={id}
            label={label}
            description={deleteDescription}
            onDeleted={onDelete}
          />
        </>
      ) : null}
    </div>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  resource,
  id,
  label,
  description,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ListResource;
  id: number;
  label: string;
  description?: ReactNode;
  onDeleted?: () => void;
}) {
  const remove = useDeleteResource(resource);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.{description ? <> {description}</> : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) so the dialog stays open while deleting. */}
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(id, {
                onSuccess: () => {
                  onOpenChange(false);
                  onDeleted?.();
                },
              })
            }
          >
            {remove.isPending ? <KitSpinner label="Deleting" /> : <Trash2Icon aria-hidden />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
