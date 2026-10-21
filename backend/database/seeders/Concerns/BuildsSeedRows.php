<?php

namespace Database\Seeders\Concerns;

/**
 * Helpers for seeders that write with batch insert/upsert: those bypass Eloquent
 * casts and timestamps, so JSON and timestamps are set by hand.
 */
trait BuildsSeedRows
{
    protected function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /** @return array{created_at: string, updated_at: string} */
    protected function timestamps(): array
    {
        $now = now()->toDateTimeString();

        return ['created_at' => $now, 'updated_at' => $now];
    }

    /**
     * Columns an upsert may overwrite on re-seed: every seeded column except the
     * unique key(s) and created_at. Only AdminUserSeeder overwrites; content seeders are insert-only.
     *
     * @param  array<string, mixed>  $row
     * @param  list<string>  $uniqueBy
     * @return list<string>
     */
    protected function updatableColumns(array $row, array $uniqueBy): array
    {
        return array_values(array_diff(array_keys($row), [...$uniqueBy, 'created_at']));
    }
}
