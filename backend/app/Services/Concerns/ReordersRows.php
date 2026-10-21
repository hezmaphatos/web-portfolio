<?php

namespace App\Services\Concerns;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Drag-and-drop reorder (docs/API.md → Reorder): one locked SELECT, one UPSERT, in one transaction.
 * ReorderRequest already returned 422 for unknown ids; the count check here only catches a row
 * deleted in between (the lock makes that delete wait, or the reorder sees the row is gone),
 * so the upsert can never re-insert a deleted row.
 *
 * The upsert sends full rows: an INSERT … ON DUPLICATE KEY UPDATE with only `id` + `sort_order`
 * fails on NOT NULL columns in both MySQL strict mode and SQLite, even though every row exists.
 */
trait ReordersRows
{
    /**
     * @param  array<int, array{id: int|string, sort_order: int|string}>  $items
     */
    protected function reorderRows(string $table, array $items): void
    {
        $order = [];
        foreach ($items as $item) {
            $order[(int) $item['id']] = (int) $item['sort_order'];
        }

        if ($order === []) {
            return;
        }

        DB::transaction(function () use ($table, $order) {
            $rows = array_map(
                fn ($row) => (array) $row,
                DB::table($table)->whereIn('id', array_keys($order))->lockForUpdate()->get()->toArray(),
            );

            if (count($rows) !== count($order)) {
                throw ValidationException::withMessages(['items' => 'One or more items do not exist.']);
            }

            $now = now();
            $rows = array_map(fn (array $row) => array_merge($row, [
                'sort_order' => $order[(int) $row['id']],
                'updated_at' => $now,
            ]), $rows);

            DB::table($table)->upsert($rows, ['id'], ['sort_order', 'updated_at']);
        });
    }
}
