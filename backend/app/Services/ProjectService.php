<?php

namespace App\Services;

use App\Models\Project;
use App\Services\Concerns\ReordersRows;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Projects: public summaries, detail and counters; admin CRUD and reorder.
 * Response shapes: docs/API.md → ProjectSummary, `GET /public/projects/{slug}`, Admin → Projects.
 */
class ProjectService
{
    use ReordersRows;

    /** `projects.boss_tier` column default, used for the HP preset when no tier is sent. */
    private const DEFAULT_TIER = 'regular';

    /** Request keys that are relations, not `projects` columns. */
    private const RELATION_KEYS = ['skill_ids', 'gallery'];

    private const ADMIN_RELATIONS = ['cover', 'video', 'bossSprite', 'og', 'skills', 'gallery'];

    private const SUMMARY_COLUMNS = [
        'id', 'slug', 'title', 'tagline', 'summary', 'category', 'kind', 'progress', 'role', 'team_size',
        'year_start', 'year_end', 'accent_color', 'is_featured', 'sort_order',
    ];

    private const LINK_COLUMNS = ['live_url', 'repo_url', 'allow_iframe_preview'];

    public function __construct(
        private readonly MediaService $media,
        private readonly RevalidationService $revalidation,
    ) {}

    /* ---------------------------------------------------------------- public */

    /**
     * Published projects as ProjectSummary[], ordered by sort_order then id.
     *
     * @param  array{category?: string|null, skill?: string|null, q?: string|null}  $filters
     * @return array<int, array<string, mixed>>
     */
    public function publicSummaries(array $filters = []): array
    {
        $category = $filters['category'] ?? null;
        $skill = $filters['skill'] ?? null;
        $search = trim((string) ($filters['q'] ?? ''));

        $rows = Project::query()
            ->published()
            ->with($this->publicRelations())
            ->when($category, fn (Builder $query) => $query->where('category', $category))
            ->when($skill, fn (Builder $query) => $query->whereHas('skills', fn (Builder $skills) => $skills
                ->where('skills.slug', $skill)
                ->where('skills.is_visible', true)))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $where) => $where
                ->whereLike('title', '%'.$search.'%')
                ->orWhereLike('tagline', '%'.$search.'%')
                ->orWhereLike('summary', '%'.$search.'%')))
            ->ordered()
            ->get()
            ->toArray();

        return array_map(fn (array $project) => $this->summary($project), $rows);
    }

    public function publishedCount(): int
    {
        return Project::query()->published()->count();
    }

    /**
     * ProjectSummary + story, gallery, SEO and prev/next. Drafts only for an authenticated admin (preview).
     *
     * @return array<string, mixed>
     */
    public function publicDetail(string $slug, bool $includeDrafts = false): array
    {
        $project = Project::query()
            ->with($this->publicRelations(withOg: true))
            ->where('slug', $slug)
            ->unless($includeDrafts, fn (Builder $query) => $query->published())
            ->firstOrFail()
            ->toArray();

        return array_merge($this->summary($project), [
            'status' => $project['status'],
            'problem' => $project['problem'],
            'solution' => $project['solution'],
            'impact' => $project['impact'],
            'description' => $project['description'],
            'highlights' => $this->stringList($project['highlights']),
            'challenges' => $this->stringList($project['challenges']),
            'video_url' => $project['video_url'],
            'video' => $this->media->present($this->uploadedVideo($project)),
            'gallery' => array_map(fn (array $media) => array_merge((array) $this->media->present($media), [
                'device' => $media['pivot']['device'],
                'caption' => $media['pivot']['caption'],
            ]), $project['gallery']),
            'seo_title' => $project['seo_title'],
            'seo_description' => $project['seo_description'],
            'og_image' => $this->media->present($project['og']),
            'prev' => $this->neighbour($project, before: true),
            'next' => $this->neighbour($project, before: false),
        ]);
    }

    /**
     * @return array{view_count: int}
     */
    public function recordView(string $slug): array
    {
        if ($this->publishedBySlug($slug)->increment('view_count') === 0) {
            throw $this->notFound();
        }

        return ['view_count' => (int) $this->publishedBySlug($slug)->value('view_count')];
    }

    /**
     * @return array{defeat_count: int}
     */
    public function recordDefeat(string $slug): array
    {
        if ($this->publishedBySlug($slug)->where('boss_enabled', true)->increment('defeat_count') === 0) {
            if (! $this->publishedBySlug($slug)->exists()) {
                throw $this->notFound();
            }

            throw ValidationException::withMessages(['boss' => 'This project has no boss.']);
        }

        return ['defeat_count' => (int) $this->publishedBySlug($slug)->value('defeat_count')];
    }

    /* ----------------------------------------------------------------- admin */

    /**
     * Every project (drafts included) as admin table rows, ordered by sort_order then id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function adminIndex(): array
    {
        $rows = Project::query()
            ->with('cover')
            ->withCount(['skills', 'gallery'])
            ->ordered()
            ->get()
            ->toArray();

        return array_map(fn (array $project) => array_merge(
            $this->pick($project, ['id', 'slug', 'title', 'status', 'category', 'kind', 'is_featured', 'accent_color']),
            [
                'cover' => $this->media->present($project['cover']),
                'skills_count' => (int) $project['skills_count'],
                'gallery_count' => (int) $project['gallery_count'],
            ],
            $this->pick($project, ['boss_enabled', 'boss_tier', 'boss_hp', 'view_count', 'defeat_count', 'sort_order', 'updated_at']),
        ), $rows);
    }

    /**
     * Everything editable plus the related media and skills.
     *
     * @return array<string, mixed>
     */
    public function adminShow(int $id): array
    {
        $project = Project::query()->with(self::ADMIN_RELATIONS)->findOrFail($id)->toArray();

        return array_merge(
            $this->pick($project, [
                'id', 'slug', 'title', 'tagline', 'category', 'kind', 'progress', 'status', 'role', 'team_size',
                'year_start', 'year_end', 'accent_color', 'is_featured', 'sort_order',
                'summary', 'problem', 'solution', 'impact', 'description',
            ]),
            [
                'highlights' => $this->stringList($project['highlights']),
                'challenges' => $this->stringList($project['challenges']),
                'skill_ids' => array_column($project['skills'], 'id'),
                'skills' => array_map(fn (array $skill) => $this->skillRef($skill), $project['skills']),
            ],
            $this->pick($project, ['boss_enabled', 'boss_tier', 'boss_hp', 'boss_name', 'boss_media_id']),
            [
                'boss_sprite' => $this->media->present($project['boss_sprite']),
                'boss_intro' => $project['boss_intro'],
                'boss_defeat_text' => $project['boss_defeat_text'],
                'cover_media_id' => $project['cover_media_id'],
                'cover' => $this->media->present($project['cover']),
                'gallery' => array_map(fn (array $media) => [
                    'media_id' => $media['id'],
                    'device' => $media['pivot']['device'],
                    'caption' => $media['pivot']['caption'],
                    'media' => $this->media->present($media),
                ], $project['gallery']),
                'video_url' => $project['video_url'],
                'video_media_id' => $project['video_media_id'],
                'video' => $this->media->present($project['video']),
            ],
            $this->pick($project, [...self::LINK_COLUMNS, 'seo_title', 'seo_description', 'og_media_id']),
            ['og_image' => $this->media->present($project['og'])],
            $this->pick($project, ['view_count', 'defeat_count', 'created_at', 'updated_at']),
        );
    }

    /**
     * @param  array<string, mixed>  $data  StoreProjectRequest::validated() (related ids already checked there)
     * @return array<string, mixed> adminShow() of the new project
     */
    public function store(array $data): array
    {
        $columns = $this->normaliseLists(array_diff_key($data, array_flip(self::RELATION_KEYS)));
        if (blank($columns['slug'] ?? null)) {
            $columns['slug'] = $this->uniqueSlug($columns['title']);
        }
        $columns['boss_hp'] ??= Project::BOSS_TIERS[$columns['boss_tier'] ?? self::DEFAULT_TIER];
        $columns['sort_order'] ??= $this->nextSortOrder();

        $id = $this->guardSlug(fn () => DB::transaction(function () use ($columns, $data) {
            $project = Project::query()->create($columns);
            $this->syncRelations($project, $data, fresh: true);

            return (int) $project['id'];
        }));

        $this->revalidation->revalidateProjects([$columns['slug']]);

        return $this->adminShow($id);
    }

    /**
     * Partial update: omitted keys stay unchanged; `skill_ids` / `gallery`, when sent, replace the lists.
     *
     * @param  array<string, mixed>  $data  UpdateProjectRequest::validated() (related ids and merged state checked there)
     * @return array<string, mixed> adminShow()
     */
    public function update(int $id, array $data): array
    {
        $project = Project::query()->findOrFail($id);

        $columns = $this->normaliseLists(array_diff_key($data, array_flip(self::RELATION_KEYS)));
        $oldSlug = $project['slug'];

        if (array_key_exists('slug', $columns) && blank($columns['slug'])) {
            $columns['slug'] = $this->uniqueSlug($columns['title'] ?? $project['title'], $id);
        }
        if (array_key_exists('boss_hp', $columns) && $columns['boss_hp'] === null) {
            $columns['boss_hp'] = Project::BOSS_TIERS[$columns['boss_tier'] ?? $project['boss_tier']];
        }
        if (array_key_exists('sort_order', $columns) && $columns['sort_order'] === null) {
            unset($columns['sort_order']);
        }

        $this->guardSlug(fn () => DB::transaction(function () use ($project, $columns, $data) {
            $project->update($columns);
            $this->syncRelations($project, $data);
        }));

        $newSlug = $columns['slug'] ?? $oldSlug;
        $this->revalidation->revalidateProjects($newSlug === $oldSlug ? [$newSlug] : [$newSlug, $oldSlug]);

        return $this->adminShow($id);
    }

    /**
     * @return array{ok: true}
     */
    public function destroy(int $id): array
    {
        $project = Project::query()->findOrFail($id);
        $slug = $project['slug'];

        DB::transaction(function () use ($project) {
            $project->skills()->detach();
            $project->gallery()->detach();
            $project->delete();
        });

        $this->revalidation->revalidateProjects([$slug]);

        return ['ok' => true];
    }

    /**
     * Prev/next of every project change, so only the shared tags are sent
     * (project detail pages are also tagged `projects`).
     *
     * @param  array<int, array{id: int, sort_order: int}>  $items
     * @return array{ok: true}
     */
    public function reorder(array $items): array
    {
        $this->reorderRows('projects', $items);
        $this->revalidation->revalidateProjects();

        return ['ok' => true];
    }

    /* --------------------------------------------------------------- shaping */

    /**
     * @param  array<string, mixed>  $project  row with cover, video, boss_sprite, gallery, skills loaded
     * @return array<string, mixed>
     */
    private function summary(array $project): array
    {
        $images = array_values(array_filter($project['gallery'], fn (array $media) => $this->isImage($media)));
        $notCover = array_filter($images, fn (array $media) => (int) $media['id'] !== (int) $project['cover_media_id']);
        $video = $this->uploadedVideo($project);

        return array_merge(
            $this->pick($project, self::SUMMARY_COLUMNS),
            [
                'cover' => $this->media->present($project['cover']),
                'hover_image' => $this->media->present(array_values($notCover)[0] ?? null),
                'hover_video' => $this->media->present($video),
                'peek' => $this->media->presentMany(array_slice($images, 0, 4)),
                'gallery_count' => count($project['gallery']),
                'skills' => array_map(fn (array $skill) => $this->skillRef($skill), $project['skills']),
                'boss' => $this->boss($project),
            ],
            $this->pick($project, self::LINK_COLUMNS),
            ['has_video' => filled($project['video_url']) || $video !== null],
        );
    }

    /**
     * @param  array<string, mixed>  $project
     * @return array<string, mixed>
     */
    private function boss(array $project): array
    {
        return [
            'enabled' => $project['boss_enabled'],
            'tier' => $project['boss_tier'],
            'name' => filled($project['boss_name']) ? $project['boss_name'] : $project['title'],
            'hp' => $project['boss_hp'],
            'sprite' => $this->media->present($project['boss_sprite']),
            'intro' => $project['boss_intro'],
            'defeat_text' => $project['boss_defeat_text'],
        ];
    }

    /**
     * @param  array<string, mixed>  $skill
     * @return array<string, mixed>
     */
    private function skillRef(array $skill): array
    {
        return $this->pick($skill, ['id', 'name', 'slug', 'category', 'level', 'icon_key']);
    }

    /**
     * Previous/next published project around ($project.sort_order, $project.id): one small query each.
     *
     * @param  array<string, mixed>  $project
     * @return array{slug: string, title: string, accent_color: string}|null
     */
    private function neighbour(array $project, bool $before): ?array
    {
        $operator = $before ? '<' : '>';
        $direction = $before ? 'desc' : 'asc';
        $sortOrder = $project['sort_order'];

        return Project::query()
            ->published()
            ->where(fn (Builder $query) => $query
                ->where('sort_order', $operator, $sortOrder)
                ->orWhere(fn (Builder $tie) => $tie->where('sort_order', $sortOrder)->where('id', $operator, $project['id'])))
            ->orderBy('sort_order', $direction)
            ->orderBy('id', $direction)
            ->first(['slug', 'title', 'accent_color'])
            ?->toArray();
    }

    /**
     * Eager loads for the public shapes. Skills hidden by the admin (is_visible = false) are left out.
     *
     * @return array<int|string, mixed>
     */
    private function publicRelations(bool $withOg = false): array
    {
        $relations = [
            'cover', 'video', 'bossSprite', 'gallery',
            'skills' => fn ($query) => $query->where('skills.is_visible', true),
        ];

        if ($withOg) {
            $relations[] = 'og';
        }

        return $relations;
    }

    /**
     * The uploaded video media row, only when it really is a video.
     *
     * @param  array<string, mixed>  $project
     * @return array<string, mixed>|null
     */
    private function uploadedVideo(array $project): ?array
    {
        $video = $project['video'] ?? null;

        return $video !== null && str_starts_with((string) $video['mime'], 'video/') ? $video : null;
    }

    /**
     * @param  array<string, mixed>  $media
     */
    private function isImage(array $media): bool
    {
        return str_starts_with((string) $media['mime'], 'image/');
    }

    /**
     * The given keys of a row, in that order (a missing key is a bug and throws).
     *
     * @param  array<string, mixed>  $row
     * @param  array<int, string>  $keys
     * @return array<string, mixed>
     */
    private function pick(array $row, array $keys): array
    {
        return array_combine($keys, array_map(fn (string $key) => $row[$key], $keys));
    }

    /* ---------------------------------------------------------------- writes */

    /**
     * Writes each sent list with one DELETE + one batch INSERT, whatever its length
     * (`sync()` with pivot data runs one INSERT or UPDATE per row). Position = pivot sort_order.
     *
     * @param  array<string, mixed>  $data
     */
    private function syncRelations(Project $project, array $data, bool $fresh = false): void
    {
        if (array_key_exists('skill_ids', $data)) {
            $skills = [];
            foreach (array_values($data['skill_ids'] ?? []) as $index => $skillId) {
                $skills[(int) $skillId] = ['sort_order' => $index];
            }
            if (! $fresh) {
                $project->skills()->detach();
            }
            $project->skills()->attach($skills);
        }

        if (array_key_exists('gallery', $data)) {
            $gallery = [];
            foreach (array_values($data['gallery'] ?? []) as $index => $item) {
                $gallery[(int) $item['media_id']] = [
                    'device' => $item['device'] ?? Project::DEVICES[0],
                    'caption' => $item['caption'] ?? null,
                    'sort_order' => $index,
                ];
            }
            if (! $fresh) {
                $project->gallery()->detach();
            }
            $project->gallery()->attach($gallery);
        }
    }

    /**
     * highlights / challenges are stored and returned as JSON lists ([] when null).
     *
     * @param  array<string, mixed>  $columns
     * @return array<string, mixed>
     */
    private function normaliseLists(array $columns): array
    {
        foreach (['highlights', 'challenges'] as $key) {
            if (array_key_exists($key, $columns)) {
                $columns[$key] = $this->stringList($columns[$key]);
            }
        }

        return $columns;
    }

    /**
     * @return array<int, string>
     */
    private function stringList(mixed $items): array
    {
        return is_array($items) ? array_values(array_filter($items, 'is_string')) : [];
    }

    /**
     * Two saves racing for the same slug (a double-click on Save): the unique index wins and the
     * losing request gets a 422 on `slug` instead of a 500.
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
     * Slug from the title, made unique with -2, -3, … using one query for the taken candidates.
     */
    private function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = rtrim(substr(Str::slug($title), 0, 110), '-');
        $base = $base !== '' ? $base : 'project';

        $rows = Project::query()
            ->where(fn (Builder $query) => $query->where('slug', $base)->orWhere('slug', 'like', $base.'-%'))
            ->when($ignoreId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreId))
            ->get(['slug'])
            ->toArray();
        $taken = array_flip(array_column($rows, 'slug'));

        $slug = $base;
        for ($suffix = 2; isset($taken[$slug]); $suffix++) {
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }

    /** New projects without sort_order go last. */
    private function nextSortOrder(): int
    {
        $max = Project::query()->max('sort_order');

        return $max === null ? 0 : min((int) $max + 1, 65535);
    }

    /** Counter updates skip Eloquent so `updated_at` (last admin edit) is not touched. */
    private function publishedBySlug(string $slug): QueryBuilder
    {
        return Project::query()->published()->where('slug', $slug)->toBase();
    }

    private function notFound(): ModelNotFoundException
    {
        return (new ModelNotFoundException)->setModel(Project::class);
    }
}
