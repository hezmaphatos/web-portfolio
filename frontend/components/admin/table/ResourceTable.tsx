"use client";

import { useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  functionalUpdate,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ListOrderedIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import {
  resourceTableFeatures,
  type ResourceColumnDef,
  type ResourceColumnMeta,
} from "@/components/admin/table/features";
import { ReorderBody } from "@/components/admin/table/ReorderBody";
import { KitEmpty, KitError, KitSpinner } from "@/components/admin/table/states";
import { cn } from "@/lib/utils";

export type ResourceRow = { id: number };

export type ResourceTableProps<T extends ResourceRow> = {
  /** Full list (undefined while loading). Order = `sort_order` order from the API. */
  rows: T[] | undefined;
  /** Columns built with `resourceColumnHelper<T>()` at module scope (keep them stable). */
  columns: ReadonlyArray<ResourceColumnDef<T>>;
  /** Defaults to `row.id`. */
  getRowId?: (row: T) => number;
  /** Row name for drag announcements / move buttons. Defaults to `#id`. */
  getRowLabel?: (row: T) => string;
  /** Client-side search: the row fields to match, or a custom predicate. Omit to hide search. */
  searchKeys?: ReadonlyArray<keyof T & string>;
  searchFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** e.g. `[{ id: "updated_at", desc: true }]` (ids = column ids). Default: API order. */
  initialSort?: SortingState;
  pageSize?: number;
  /** Enables "Reorder" mode (drag handles + keyboard + move buttons). Receives every id in the
   * new order; return the mutation promise (`reorder.mutateAsync`) so the bar waits for it. */
  onReorder?: (orderedIds: number[]) => unknown;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Shown when the list is empty (not when a search has no match). */
  emptyState?: ReactNode;
  /** Clicking a row (outside buttons/links/switches) navigates here. */
  rowHref?: (row: T) => string;
  /** Extra controls on the right of the toolbar (filters, "Add" button…). */
  toolbar?: ReactNode;
  /** Accessible table name (rendered as a visually hidden caption). */
  caption?: string;
  className?: string;
};

const EMPTY: never[] = [];
const INTERACTIVE =
  "a,button,input,select,textarea,label,[role=switch],[role=checkbox],[role=menuitem],[data-no-row-click]";

function alignClass(meta: ResourceColumnMeta | undefined): string {
  if (meta?.align === "end") return "text-right";
  if (meta?.align === "center") return "text-center";
  return "";
}

function matchesQuery<T>(row: T, keys: ReadonlyArray<keyof T & string>, query: string): boolean {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (text.toLowerCase().includes(query)) return true;
  }
  return false;
}

/**
 * The one admin list table: search, sort, pagination, skeleton/empty/error states, row links and
 * an optional drag-and-drop "Reorder" mode (sort/search/pagination are paused while reordering).
 */
export function ResourceTable<T extends ResourceRow>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  searchKeys,
  searchFn,
  searchPlaceholder = "Search…",
  initialSort,
  pageSize = 20,
  onReorder,
  isLoading = false,
  error,
  onRetry,
  emptyState,
  rowHref,
  toolbar,
  caption,
  className,
}: ResourceTableProps<T>) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  /** Non-null while in reorder mode: row ids in the edited order. */
  const [order, setOrder] = useState<number[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const idOf = getRowId ?? ((row: T) => row.id);
  const labelOf = getRowLabel ?? ((row: T) => `#${idOf(row)}`);
  const reordering = order !== null;
  const canSearch = Boolean(searchKeys?.length || searchFn);
  const needle = query.trim().toLowerCase();

  const allRows = rows ?? EMPTY;

  const data = useMemo<T[]>(() => {
    if (order) {
      const byId = new Map(allRows.map((row) => [idOf(row), row]));
      return order.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
    }
    if (!needle) return allRows;
    return allRows.filter((row) =>
      searchFn ? searchFn(row, needle) : matchesQuery(row, searchKeys ?? [], needle),
    );
    // idOf / searchFn may be inline props; rows + query + order are what change the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, order, needle]);

  const pageCount = Math.max(1, Math.ceil(data.length / pagination.pageSize));
  const clamp = (state: PaginationState): PaginationState =>
    state.pageIndex > pageCount - 1 ? { ...state, pageIndex: pageCount - 1 } : state;
  const effectivePagination: PaginationState = reordering
    ? { pageIndex: 0, pageSize: Math.max(1, data.length) }
    : clamp(pagination);

  const table = useTable({
    features: resourceTableFeatures,
    columns,
    data,
    getRowId: (row) => String(idOf(row)),
    state: { sorting: reordering ? EMPTY : sorting, pagination: effectivePagination },
    onSortingChange: (updater) => setSorting((prev) => functionalUpdate(updater, prev)),
    onPaginationChange: (updater) =>
      setPagination((prev) => functionalUpdate(updater, clamp(prev))),
    autoResetPageIndex: false,
    autoResetSorting: false,
    enableSorting: !reordering,
    enableSortingRemoval: true,
    // First click sorts ascending for every column (numbers would default to descending);
    // a column can still opt in with `sortDescFirst: true` (e.g. view counts).
    sortDescFirst: false,
  });

  const headerGroups = table.getHeaderGroups();
  const visibleRows = table.getRowModel().rows;
  const columnCount = columns.length + (reordering ? 1 : 0);
  const total = data.length;
  const firstIndex =
    total === 0 ? 0 : effectivePagination.pageIndex * effectivePagination.pageSize + 1;
  const lastIndex = Math.min(total, firstIndex + visibleRows.length - 1);

  const originalOrder = allRows.map(idOf);
  const orderChanged = order !== null && order.some((id, index) => id !== originalOrder[index]);

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!rowHref || reordering) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return; // the user is selecting text
    const href = rowHref(row);
    if (event.metaKey || event.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  }

  async function saveOrder() {
    if (!order || !onReorder) return;
    setSavingOrder(true);
    try {
      await onReorder(order);
      setOrder(null);
    } catch {
      // The mutation already toasted and rolled back; stay in reorder mode so nothing is lost.
    } finally {
      setSavingOrder(false);
    }
  }

  const loading = isLoading && rows === undefined;
  const failed = Boolean(error) && rows === undefined;

  let body: ReactNode;
  if (loading) {
    body = Array.from({ length: 5 }, (_, index) => (
      <TableRow key={`skeleton-${index}`} aria-hidden>
        {Array.from({ length: columnCount }, (_, cell) => (
          <TableCell key={cell}>
            <Skeleton className={cn("h-4", cell === 0 ? "w-3/4" : "w-1/2")} />
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (failed) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount}>
          <KitError error={error} onRetry={onRetry} />
        </TableCell>
      </TableRow>
    );
  } else if (allRows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount}>
          {emptyState ?? <KitEmpty title="Nothing here yet" />}
        </TableCell>
      </TableRow>
    );
  } else if (visibleRows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount}>
          <KitEmpty
            title={`No results for “${query.trim()}”`}
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {reordering ? (
        <div
          className="bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
          role="region"
          aria-label="Reorder mode"
        >
          <p className="text-muted-foreground text-sm">
            Drag rows by the handle, or focus a handle and use Space + arrow keys. The move buttons
            work too.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingOrder}
              onClick={() => setOrder(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!orderChanged || savingOrder}
              onClick={saveOrder}
            >
              {savingOrder ? <KitSpinner label="Saving order" /> : null}
              Save order
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canSearch ? (
            <div className="relative w-full max-w-xs">
              <label htmlFor={searchId} className="sr-only">
                {searchPlaceholder.replace(/…$/, "")}
              </label>
              <SearchIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
                className="pr-8 pl-8"
                disabled={loading || failed}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 outline-none focus-visible:ring-2"
                >
                  <XIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">Clear search</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {toolbar}
            {onReorder ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || failed || allRows.length < 2}
                onClick={() => setOrder(allRows.map(idOf))}
              >
                <ListOrderedIcon aria-hidden />
                Reorder
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table aria-busy={loading || undefined}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            {headerGroups.map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {reordering ? (
                  <TableHead className="w-28">
                    <span className="sr-only">Move</span>
                  </TableHead>
                ) : null}
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const canSort = !reordering && header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        canSort
                          ? sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className={cn(alignClass(meta), meta?.headerClassName)}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none focus-visible:ring-2",
                            meta?.align === "end" && "flex-row-reverse",
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          {body ? (
            <TableBody>{body}</TableBody>
          ) : reordering && order ? (
            <ReorderBody
              order={order}
              onOrderChange={setOrder}
              rows={visibleRows}
              labelOf={(rowId) => {
                const row = data.find((item) => idOf(item) === rowId);
                return row ? labelOf(row) : `#${rowId}`;
              }}
              renderCells={(row) =>
                row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell key={cell.id} className={cn(alignClass(meta), meta?.className)}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })
              }
              disabled={savingOrder}
            />
          ) : (
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={(event) => onRowClick(event, row.original)}
                  className={cn(rowHref && "cursor-pointer")}
                >
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell key={cell.id} className={cn(alignClass(meta), meta?.className)}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      {!loading && !failed && total > 0 && !reordering ? (
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
          <p aria-live="polite">
            {firstIndex}–{lastIndex} of {total}
            {needle ? ` (filtered from ${allRows.length})` : ""}
          </p>
          {pageCount > 1 ? (
            <nav className="flex items-center gap-1" aria-label="Pagination">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeftIcon aria-hidden />
                <span className="sr-only">First page</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon aria-hidden />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="px-2 tabular-nums">
                Page {effectivePagination.pageIndex + 1} of {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon aria-hidden />
                <span className="sr-only">Next page</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.lastPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRightIcon aria-hidden />
                <span className="sr-only">Last page</span>
              </Button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
