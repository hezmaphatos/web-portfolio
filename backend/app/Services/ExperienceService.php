<?php

namespace App\Services;

use App\Models\Experience;
use App\Services\Concerns\ReordersRows;

/**
 * Quest log entries: admin CRUD + reorder, and the public list used by HomeService
 * (docs/API.md → Experiences).
 */
class ExperienceService
{
    use ReordersRows;

    public function __construct(
        private readonly MediaService $media,
        private readonly RevalidationService $revalidation,
    ) {}

    /**
     * Visible experiences for `/public/home`, by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publicList(): array
    {
        $rows = Experience::query()
            ->with('logo')
            ->where('is_visible', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->presentPublic($row), $rows);
    }

    /**
     * Every experience (hidden ones included), by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function adminList(): array
    {
        $rows = Experience::query()->with('logo')->orderBy('sort_order')->orderBy('id')->get()->toArray();

        return array_map(fn (array $row) => $this->presentAdmin($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function find(int $id): array
    {
        return $this->presentAdmin(Experience::query()->with('logo')->findOrFail($id)->toArray());
    }

    /**
     * @param  array<string, mixed>  $data  validated StoreExperienceRequest data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $data = $this->normalise($data);
        $data['sort_order'] ??= $this->nextSortOrder();

        $experience = Experience::create($data);

        $this->revalidation->revalidateHome();

        return $this->find((int) $experience['id']);
    }

    /**
     * Partial update: absent fields keep their value.
     *
     * @param  array<string, mixed>  $data  validated UpdateExperienceRequest data (merged date order checked there)
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        $experience = Experience::query()->findOrFail($id);

        $experience->update($this->normalise($data));

        $this->revalidation->revalidateHome();

        return $this->find($id);
    }

    /**
     * @return array{ok: bool}
     */
    public function delete(int $id): array
    {
        Experience::query()->findOrFail($id)->delete();

        $this->revalidation->revalidateHome();

        return ['ok' => true];
    }

    /**
     * @param  array<int, array{id: int, sort_order: int}>  $items
     * @return array{ok: bool}
     */
    public function reorder(array $items): array
    {
        $this->reorderRows('experiences', $items);

        $this->revalidation->revalidateHome();

        return ['ok' => true];
    }

    /**
     * @param  array<string, mixed>  $row  experiences row with `logo` loaded
     * @return array<string, mixed>
     */
    private function presentPublic(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'type' => $row['type'],
            'title' => $row['title'],
            'organization' => $row['organization'],
            'location' => $row['location'],
            'subtitle' => $row['subtitle'],
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'is_current' => $row['end_date'] === null,
            'description' => $row['description'],
            'bullets' => $this->bullets($row['bullets']),
            'metrics' => $this->metrics($row['metrics']),
            'logo' => $this->media->present($row['logo'] ?? null),
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
            'logo_media_id' => $row['logo_media_id'] !== null ? (int) $row['logo_media_id'] : null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }

    /**
     * Stores the JSON lists in their public shape; a null sort_order means "leave as is / append".
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalise(array $data): array
    {
        if (array_key_exists('bullets', $data)) {
            $data['bullets'] = $this->bullets($data['bullets']);
        }
        if (array_key_exists('metrics', $data)) {
            $data['metrics'] = $this->metrics($data['metrics']);
        }
        if (array_key_exists('sort_order', $data) && $data['sort_order'] === null) {
            unset($data['sort_order']);
        }

        return $data;
    }

    /**
     * @return array<int, string>
     */
    private function bullets(mixed $items): array
    {
        $items = is_array($items) ? $items : [];

        return array_values(array_map(
            fn ($item) => (string) $item,
            array_filter($items, fn ($item) => is_scalar($item) && $item !== ''),
        ));
    }

    /**
     * @return array<int, array{label: string, value: int|float, prefix: string, suffix: string}>
     */
    private function metrics(mixed $items): array
    {
        $items = is_array($items) ? array_values(array_filter($items, 'is_array')) : [];

        return array_map(fn (array $item) => [
            'label' => $this->text($item['label'] ?? null),
            'value' => $this->number($item['value'] ?? null),
            'prefix' => $this->text($item['prefix'] ?? null),
            'suffix' => $this->text($item['suffix'] ?? null),
        ], $items);
    }

    /** "50" → 50, 50.0 → 50, "1.3" → 1.3; non-numeric → 0. */
    private function number(mixed $value): int|float
    {
        if (! is_numeric($value)) {
            return 0;
        }

        $number = (float) $value;

        return fmod($number, 1.0) === 0.0 ? (int) $number : $number;
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private function nextSortOrder(): int
    {
        $max = Experience::query()->max('sort_order');

        return $max === null ? 0 : min((int) $max + 1, 65535);
    }
}
