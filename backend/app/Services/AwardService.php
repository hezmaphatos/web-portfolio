<?php

namespace App\Services;

use App\Models\Award;
use App\Services\Concerns\ReordersRows;

/**
 * Trophy room: admin CRUD + reorder, and the public list used by HomeService
 * (docs/API.md → Awards).
 */
class AwardService
{
    use ReordersRows;

    public function __construct(
        private readonly MediaService $media,
        private readonly RevalidationService $revalidation,
    ) {}

    /**
     * Visible awards for `/public/home`, by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publicList(): array
    {
        $rows = Award::query()
            ->with('media')
            ->where('is_visible', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->presentPublic($row), $rows);
    }

    /**
     * Every award (hidden ones included), by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function adminList(): array
    {
        $rows = Award::query()->with('media')->orderBy('sort_order')->orderBy('id')->get()->toArray();

        return array_map(fn (array $row) => $this->presentAdmin($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function find(int $id): array
    {
        return $this->presentAdmin(Award::query()->with('media')->findOrFail($id)->toArray());
    }

    /**
     * @param  array<string, mixed>  $data  validated StoreAwardRequest data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $data = $this->normalise($data);
        $data['sort_order'] ??= $this->nextSortOrder();

        $award = Award::create($data);

        $this->revalidation->revalidateHome();

        return $this->find((int) $award['id']);
    }

    /**
     * Partial update: absent fields keep their value.
     *
     * @param  array<string, mixed>  $data  validated UpdateAwardRequest data
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        $award = Award::query()->findOrFail($id);
        $award->update($this->normalise($data));

        $this->revalidation->revalidateHome();

        return $this->find($id);
    }

    /**
     * @return array{ok: bool}
     */
    public function delete(int $id): array
    {
        Award::query()->findOrFail($id)->delete();

        $this->revalidation->revalidateHome();

        return ['ok' => true];
    }

    /**
     * @param  array<int, array{id: int, sort_order: int}>  $items
     * @return array{ok: bool}
     */
    public function reorder(array $items): array
    {
        $this->reorderRows('awards', $items);

        $this->revalidation->revalidateHome();

        return ['ok' => true];
    }

    /**
     * @param  array<string, mixed>  $row  awards row with `media` loaded
     * @return array<string, mixed>
     */
    private function presentPublic(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'event' => $row['event'],
            'issuer' => $row['issuer'],
            'year' => $row['year'] !== null ? (int) $row['year'] : null,
            'placement' => $row['placement'],
            'category' => $row['category'],
            'description' => $row['description'],
            'image' => $this->media->present($row['media'] ?? null),
            'url' => $row['url'],
            'sort_order' => (int) $row['sort_order'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function presentAdmin(array $row): array
    {
        return array_merge($this->presentPublic($row), [
            'is_visible' => (bool) $row['is_visible'],
            'media_id' => $row['media_id'] !== null ? (int) $row['media_id'] : null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }

    /**
     * A null sort_order means "leave as is" (update) or "append" (create).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalise(array $data): array
    {
        if (array_key_exists('sort_order', $data) && $data['sort_order'] === null) {
            unset($data['sort_order']);
        }

        return $data;
    }

    private function nextSortOrder(): int
    {
        $max = Award::query()->max('sort_order');

        return $max === null ? 0 : min((int) $max + 1, 65535);
    }
}
