<?php

namespace App\Services;

use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use App\Models\Message;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Support\Facades\DB;

/**
 * Admin dashboard (docs/API.md → Dashboard). Four queries whatever the data size:
 * every count in one statement, then the three top-5 lists.
 */
class DashboardService
{
    private const TOP = 5;

    public function __construct(private readonly MessageService $messages) {}

    /**
     * @return array{counts: array<string, int>, latest_messages: array<int, array<string, mixed>>, most_viewed: array<int, array<string, mixed>>, most_defeated: array<int, array<string, mixed>>}
     */
    public function overview(): array
    {
        return [
            'counts' => $this->counts(),
            'latest_messages' => $this->messages->latest(self::TOP),
            'most_viewed' => $this->topProjects('view_count', published: true),
            'most_defeated' => $this->topProjects('defeat_count', bossOnly: true),
        ];
    }

    /**
     * One SELECT with a scalar COUNT(*) subquery per number (keys in the docs/API.md order).
     *
     * @return array<string, int>
     */
    private function counts(): array
    {
        $subqueries = [
            'projects' => Project::query(),
            'published_projects' => Project::query()->where('status', 'published'),
            'skills' => Skill::query(),
            'messages' => Message::query(),
            'unread_messages' => Message::query()->whereNull('read_at'),
            'experiences' => Experience::query(),
            'awards' => Award::query(),
            'media' => Media::query(),
        ];

        $row = (array) DB::query()
            ->select(array_map(fn ($query) => $query->selectRaw('count(*)'), $subqueries))
            ->first();

        return array_map(fn ($count) => (int) $count, $row);
    }

    /**
     * Top projects by a counter, ties broken by id.
     *
     * @param  'view_count'|'defeat_count'  $counter
     * @return array<int, array<string, mixed>>
     */
    private function topProjects(string $counter, bool $published = false, bool $bossOnly = false): array
    {
        $rows = Project::query()
            ->select(['id', 'slug', 'title', $counter])
            ->when($published, fn ($query) => $query->where('status', 'published'))
            ->when($bossOnly, fn ($query) => $query->where('boss_enabled', true))
            ->orderByDesc($counter)
            ->orderBy('id')
            ->limit(self::TOP)
            ->get()
            ->toArray();

        return array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'slug' => $row['slug'],
            'title' => $row['title'],
            $counter => (int) $row[$counter],
        ], $rows);
    }
}
