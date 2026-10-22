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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SortableListProps = {
  /** Item ids in their current order. */
  ids: readonly string[];
  /** Called with the old and new index after a drop. */
  onMove: (from: number, to: number) => void;
  /** Item name for the screen-reader announcements. */
  labelOf: (id: string) => string;
  /** "vertical" for lists, "grid" for wrapping card grids. */
  layout?: "vertical" | "grid";
  disabled?: boolean;
  children: ReactNode;
};

/**
 * dnd-kit context for a sortable list or grid: pointer drag, keyboard drag (focus a handle,
 * Space/Enter to pick up, arrows to move, Space/Enter to drop, Escape to cancel) and announcements.
 * Render <SortableItem>s inside; pair every item with move buttons as the non-drag alternative.
 */
export function SortableList({
  ids,
  onMove,
  labelOf,
  layout = "vertical",
  disabled = false,
  children,
}: SortableListProps) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const position = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
  const name = (id: UniqueIdentifier) => labelOf(String(id));

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${name(active.id)}, position ${position(active.id)} of ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} moved to position ${position(over.id)} of ${ids.length}.`
        : `${name(active.id)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} dropped at position ${position(over.id)} of ${ids.length}.`
        : `${name(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To pick up an item, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel.",
        },
      }}
    >
      <SortableContext
        items={[...ids]}
        strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
        disabled={disabled}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

type SortableItemProps = {
  id: string;
  /** Used in the handle's accessible name ("Drag Laravel"). */
  label: string;
  disabled?: boolean;
  className?: string;
  /** Receives the drag handle to place inside the item. */
  children: (args: { handle: ReactNode; isDragging: boolean }) => ReactNode;
};

/** One sortable <li>. Only the handle starts a drag, so inputs inside the item keep working. */
export function SortableItem({
  id,
  label,
  disabled = false,
  className,
  children,
}: SortableItemProps) {
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

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={`Drag ${label}`}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-grab touch-none rounded p-1 outline-none focus-visible:ring-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
    >
      <GripVerticalIcon className="size-4" aria-hidden />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && "relative z-10 shadow-md ring-1 ring-black/10")}
    >
      {children({ handle, isDragging })}
    </li>
  );
}
