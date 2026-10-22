"use client";

import { Trash2Icon } from "lucide-react";

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
import { ApiError } from "@/lib/admin/api";
import type { Message } from "@/lib/types";

import { useDeleteMessage } from "./message-queries";
import { formatShortDate } from "./format";

type DeleteMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept set while the dialog animates out, so its text does not blank. */
  message: Message | null;
  onDeleted: (message: Message) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/** "Delete this message?" confirmation. Stays open (buttons disabled) until DELETE resolves. */
export function DeleteMessageDialog({
  open,
  onOpenChange,
  message,
  onDeleted,
  onCloseAutoFocus,
}: DeleteMessageDialogProps) {
  const remove = useDeleteMessage();
  const who = message ? message.name || message.email : "this sender";

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this message?</AlertDialogTitle>
          <AlertDialogDescription>
            The message from {who}
            {message ? ` (${formatShortDate(message.created_at)})` : ""} is deleted for good. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) so the dialog stays open while deleting. */}
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending || !message}
            onClick={() => {
              if (!message) return;
              remove.mutate(message.id, {
                onSettled: (_data, error) => {
                  // A 404 counts as deleted too (the hook already said so in a toast).
                  if (!error || (error instanceof ApiError && error.status === 404)) {
                    onDeleted(message);
                  }
                },
              });
            }}
          >
            {remove.isPending ? <KitSpinner label="Deleting" /> : <Trash2Icon aria-hidden />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
