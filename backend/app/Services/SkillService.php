<?php

namespace App\Services;

use App\Models\Skill;
use App\Services\Concerns\ReordersRows;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Skills: admin CRUD + reorder, and the public lists used by HomeService (docs/API.md → Skills).
 */
class SkillService
{
    use ReordersRows;

    /** Admin hint thresholds for damage per second (spec §7: keep DPS around 15–30). */
    public const DPS_STRONG = 30;

    public const DPS_WEAK = 15;

    public function __construct(
        private readonly MediaService $media,
        private readonly RevalidationService $revalidation,
    ) {}

    /**
     * Visible game skills (every category except soft) for `/public/home`.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publicList(): array
    {
        $rows = Skill::query()
            ->with('icon')
            ->where('is_visible', true)
            ->where('category', '!=', Skill::SOFT)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->presentPublic($row), $rows);
    }

    /**
     * Names of the visible soft skills, by sort_order (`site.soft_skills` on `/public/home`).
     *
     * @return array<int, string>
     */
    public function softSkillNames(): array
    {
        $rows = Skill::query()
            ->where('is_visible', true)
            ->where('category', Skill::SOFT)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['name'])
            ->toArray();

        return array_column($rows, 'name');
    }

    /**
     * Every skill (hidden ones included), ordered by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function adminList(): array
    {
        $rows = Skill::query()
            ->with('icon')
            ->withCount('projects')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->toArray();

        return array_map(fn (array $row) => $this->presentAdmin($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function find(int $id): array
    {
        $row = Skill::query()
            ->with('icon')
            ->withCount('projects')
            ->findOrFail($id)
            ->toArray();

        return $this->presentAdmin($row);
    }

    /**
     * @param  array<string, mixed>  $data  validated StoreSkillRequest data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $data = $this->normaliseGameFields($data, $data['category']);
        $data['slug'] = ($data['slug'] ?? null) ?: $this->uniqueSlug(Str::slug($data['name']));

        if (! isset($data['sort_order'])) {
            $data['sort_order'] = $this->nextSortOrder();
        }

        $skill = $this->guardSlug(fn () => Skill::create($data));

        $this->revalidation->revalidateAll();

        return $this->find((int) $skill['id']);
    }

    /**
     * Partial update: absent fields keep their value.
     *
     * @param  array<string, mixed>  $data  validated UpdateSkillRequest data (merged game fields checked there)
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        $skill = Skill::findOrFail($id);

        $data = $this->normaliseGameFields($data, $data['category'] ?? $skill['category']);

        // Absent slug keeps the current one; an empty slug is regenerated from the name.
        if (array_key_exists('slug', $data) && ! $data['slug']) {
            $data['slug'] = $this->uniqueSlug(Str::slug($data['name'] ?? $skill['name']), $id);
        }

        $this->guardSlug(fn () => $skill->update($data));

        $this->revalidation->revalidateAll();

        return $this->find($id);
    }

    /**
     * Deletes the skill and detaches it from every project.
     *
     * @return array{ok: bool}
     */
    public function delete(int $id): array
    {
        $skill = Skill::findOrFail($id);

        DB::transaction(function () use ($skill) {
            $skill->projects()->detach();
            $skill->delete();
        });

        $this->revalidation->revalidateAll();

        return ['ok' => true];
    }

    /**
     * @param  array<int, array{id: int, sort_order: int}>  $items
     * @return array{ok: bool}
     */
    public function reorder(array $items): array
    {
        $this->reorderRows('skills', $items);

        $this->revalidation->revalidateAll();

        return ['ok' => true];
    }

    /**
     * Damage per second, 1 decimal; null for soft skills (no game data).
     */
    public function dps(?int $damage, ?int $cooldownMs): ?float
    {
        if ($damage === null || ! $cooldownMs) {
            return null;
        }

        return round($damage / ($cooldownMs / 1000), 1);
    }

    public function dpsWarning(?float $dps): ?string
    {
        return match (true) {
            $dps === null => null,
            $dps > self::DPS_STRONG => 'strong',
            $dps < self::DPS_WEAK => 'weak',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $row  skills row with the `icon` relation loaded
     * @return array<string, mixed>
     */
    private function presentPublic(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'slug' => $row['slug'],
            'category' => $row['category'],
            'level' => (int) $row['level'],
            'status' => $row['status'],
            'icon_key' => $row['icon_key'],
            'icon' => $this->media->present($row['icon'] ?? null),
            'description' => $row['description'],
            'attack_name' => $row['attack_name'],
            'damage' => $row['damage'],
            'cooldown_ms' => $row['cooldown_ms'],
            'sort_order' => (int) $row['sort_order'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row  skills row with `icon` and `projects_count`
     * @return array<string, mixed>
     */
    private function presentAdmin(array $row): array
    {
        $dps = $this->dps($row['damage'], $row['cooldown_ms']);

        return array_merge($this->presentPublic($row), [
            'is_visible' => (bool) $row['is_visible'],
            'icon_media_id' => $row['icon_media_id'] !== null ? (int) $row['icon_media_id'] : null,
            'projects_count' => (int) $row['projects_count'],
            'dps' => $dps,
            'dps_warning' => $this->dpsWarning($dps),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }

    /**
     * Soft skills are never game skills: their game fields are always stored as null.
     *
     * @param  array<string, mixed>  $data
     * @param  string  $category  the category the skill has after this write
     * @return array<string, mixed>
     */
    private function normaliseGameFields(array $data, string $category): array
    {
        if ($category === Skill::SOFT) {
            $data = array_merge($data, array_fill_keys(Skill::GAME_FIELDS, null));
        }

        return $data;
    }

    /**
     * Two saves racing for the same slug: the unique index wins, the losing request gets a 422.
     *
     * @template T
     *
     * @param  callable(): T  $write
     * @return T
     */
    private function guardSlug(callable $write): mixed
    {
        try {
            return $write();
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['slug' => __('validation.unique', ['attribute' => 'slug'])]);
        }
    }

    /**
     * `$base`, or `$base-2`, `$base-3`… — one query fetches every slug that could collide.
     */
    private function uniqueSlug(string $base, ?int $ignoreId = null): string
    {
        $base = $base !== '' ? $base : 'skill';

        $rows = Skill::query()
            ->where(fn ($query) => $query->where('slug', $base)->orWhere('slug', 'like', $base.'-%'))
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->get(['slug'])
            ->toArray();

        $taken = array_flip(array_column($rows, 'slug'));

        if (! isset($taken[$base])) {
            return $base;
        }

        $suffix = 2;
        while (isset($taken[$base.'-'.$suffix])) {
            $suffix++;
        }

        return $base.'-'.$suffix;
    }

    private function nextSortOrder(): int
    {
        $max = Skill::query()->max('sort_order');

        return $max === null ? 0 : min((int) $max + 1, 65535);
    }
}
