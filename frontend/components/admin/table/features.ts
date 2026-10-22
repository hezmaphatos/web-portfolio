import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

/** Per-column presentation hints read by <ResourceTable>. */
export type ResourceColumnMeta = {
  /** Classes for every body cell of the column (e.g. "w-16", "text-right tabular-nums"). */
  className?: string;
  /** Classes for the header cell. */
  headerClassName?: string;
  /** Text alignment for header and cells. Default "start". */
  align?: "start" | "center" | "end";
};

/**
 * The one feature registry every admin table uses (react-table v9 needs it at module scope).
 * Client-side sorting + pagination; search is done by <ResourceTable> before rows reach the table.
 */
export const resourceTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
  columnMeta: metaHelper<ResourceColumnMeta>(),
});

export type ResourceTableFeatures = typeof resourceTableFeatures;

/**
 * Column definition accepted by <ResourceTable>.
 * `any` = the cell value type, which differs per column; `helper.columns([...])` returns exactly
 * this shape after checking every column against its own accessor type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResourceColumnDef<T extends RowData> = ColumnDef<ResourceTableFeatures, T, any>;

/**
 * Typed column helper. Call it at module scope:
 * `const col = resourceColumnHelper<AdminSkill>(); export const columns = col.columns([...])`.
 */
export function resourceColumnHelper<T extends RowData>() {
  return createColumnHelper<ResourceTableFeatures, T>();
}
