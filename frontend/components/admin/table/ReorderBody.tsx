"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Row, RowData } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/admin/ui/table";
import type { ResourceTableFeatures } from "@/components/admin/table/features";
import { cn } from "@/lib/utils";

type ReorderBodyProps<T extends RowData> = {
  order: number[];
  onOrderChange: (order: number[]) => void;
  /** Table rows already in `order` (one page containing every row). */
  rows: Array<Row<ResourceTableFeatures, T>>;
  labelOf: (id: number) => string;
  renderCells: (row: Row<ResourceTableFeatures, T>) => ReactNode;
  disabled?: boolean;
};

/** <tbody> with sortable rows: pointer drag, keyboard drag (Space + arrows) and move buttons. */
export function ReorderBody<T extends RowData>({
  order,
  onOrderChange,
  rows,
  labelOf,
  renderCells,
  disabled = false,
}: ReorderBodyProps<T>) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const position = (id: UniqueIdentifier) => order.indexOf(Number(id)) + 1;
  const name = (id: UniqueIdentifier) => labelOf(Number(id));

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${name(active.id)}, position ${position(active.id)} of ${order.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} moved to position ${position(over.id)} of ${order.length}.`
        : `${name(active.id)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} dropped at position ${position(over.id)} of ${order.length}.`
        : `${name(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    onOrderChange(arrayMove(order, from, to));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(order.indexOf(Number(active.id)), order.indexOf(Number(over.id)));
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        // The live region / instructions are <div>s: portal them out of the <table>.
        container: typeof document === "undefined" ? undefined : document.body,
        announcements,
        screenReaderInstructions: {
          draggable:
            "To pick up a row, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel.",
        },
      }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={disabled}>
        <TableBody>
          {rows.map((row, index) => (
            <SortableRow
              key={row.id}
              id={Number(row.id)}
              index={index}
              count={rows.length}
              label={labelOf(Number(row.id))}
              onMove={move}
              disabled={disabled}
            >
              {renderCells(row)}
            </SortableRow>
          ))}
        </TableBody>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  index,
  count,
  label,
  onMove,
  disabled,
  children,
}: {
  id: number;
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card",
        isDragging && "hover:bg-card relative z-10 shadow-md ring-1 ring-black/10",
      )}
    >
      <TableCell className="w-28">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${label}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-grab touch-none rounded p-1 outline-none focus-visible:ring-2 active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={`Move ${label} up`}
          >
            <ChevronUpIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled || index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={`Move ${label} down`}
          >
            <ChevronDownIcon aria-hidden />
          </Button>
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}
