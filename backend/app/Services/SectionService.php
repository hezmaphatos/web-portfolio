<?php

namespace App\Services;

use App\Models\Section;

/**
 * Home chapters (docs/API.md → Sections). The 8 keys and their order are fixed by the seeder:
 * the admin edits texts and visibility only (no create, delete or reorder).
 */
class SectionService
{
    public function __construct(private readonly RevalidationService $revalidation) {}

    /**
     * Visible sections for `/public/home`, by sort_order.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publicList(): array
    {
        $rows = Section::query()
            ->where('is_visible', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->presentPublic($row), $rows);
    }

    /**
     * Every section (hidden ones included), by sort_order.
     *
     * @return array<int, array<string, mixed>>
     */
    public function adminList(): array
    {
        $rows = Section::query()->orderBy('sort_order')->orderBy('id')->get()->toArray();

        return array_map(fn (array $row) => $this->presentAdmin($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function find(int $id): array
    {
        return $this->presentAdmin(Section::query()->findOrFail($id)->toArray());
    }

    /**
     * @param  array<string, mixed>  $data  validated UpdateSectionRequest data (`key` is never editable)
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        $section = Section::query()->findOrFail($id);
        $section->update($data);

        $this->revalidation->revalidateHome();

        return $this->find($id);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function presentPublic(array $row): array
    {
        return [
            'key' => $row['key'],
            'title' => $row['title'],
            'subtitle' => $row['subtitle'],
            'body' => $row['body'],
            'hint' => $row['hint'],
            'sort_order' => (int) $row['sort_order'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function presentAdmin(array $row): array
    {
        return array_merge(['id' => (int) $row['id']], $this->presentPublic($row), [
            'is_visible' => (bool) $row['is_visible'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }
}
