<?php

namespace Tests\Feature;

use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use App\Models\Message;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/dashboard';

    public function test_guests_get_401(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
    }

    public function test_empty_dashboard(): void
    {
        $this->actingAsAdmin();

        $this->getJson(self::URL)
            ->assertOk()
            ->assertExactJson(['data' => [
                'counts' => [
                    'projects' => 0, 'published_projects' => 0, 'skills' => 0, 'messages' => 0,
                    'unread_messages' => 0, 'experiences' => 0, 'awards' => 0, 'media' => 0,
                ],
                'latest_messages' => [],
                'most_viewed' => [],
                'most_defeated' => [],
            ]]);
    }

    public function test_counts_include_drafts_and_hidden_rows(): void
    {
        $this->actingAsAdmin();
        Project::factory()->count(3)->create();
        Project::factory()->draft()->create();
        Skill::factory()->count(2)->create();
        Skill::factory()->soft()->create();
        Skill::factory()->hidden()->create();
        Message::factory()->count(2)->create();
        Message::factory()->read()->create();
        Experience::factory()->count(2)->create();
        Experience::factory()->hidden()->create();
        Award::factory()->create();
        Media::factory()->count(2)->create();
        Media::factory()->pdf()->create();

        $counts = $this->getJson(self::URL)->assertOk()->json('data.counts');

        $this->assertSame([
            'projects' => 4,
            'published_projects' => 3,
            'skills' => 4,
            'messages' => 3,
            'unread_messages' => 2,
            'experiences' => 3,
            'awards' => 1,
            'media' => 3,
        ], $counts);
    }

    public function test_latest_messages_are_the_five_newest(): void
    {
        $this->actingAsAdmin();
        $ids = [];
        for ($i = 1; $i <= 7; $i++) {
            $ids[] = Message::factory()->create(['created_at' => now()->subHours(10 - $i)])['id'];
        }

        $latest = $this->getJson(self::URL)->assertOk()->json('data.latest_messages');

        $this->assertSame(array_reverse(array_slice($ids, 2)), array_column($latest, 'id'));
        $this->assertSame(['id', 'name', 'email', 'message', 'read_at', 'created_at'], array_keys($latest[0]));
    }

    public function test_most_viewed_lists_published_projects_by_view_count(): void
    {
        $this->actingAsAdmin();
        $draft = Project::factory()->draft()->create(['view_count' => 1000]);
        $views = [50, 10, 70, 10, 30, 5, 90];
        $projects = [];
        foreach ($views as $count) {
            $projects[] = Project::factory()->create(['view_count' => $count]);
        }

        $top = $this->getJson(self::URL)->assertOk()->json('data.most_viewed');

        // 90, 70, 50, 30, then the two 10s tie → lower id first.
        $expected = [$projects[6], $projects[2], $projects[0], $projects[4], $projects[1]];
        $this->assertSame(
            array_map(fn ($project) => [
                'id' => $project['id'],
                'slug' => $project['slug'],
                'title' => $project['title'],
                'view_count' => $project['view_count'],
            ], $expected),
            $top,
        );
        $this->assertNotContains($draft['id'], array_column($top, 'id'));
    }

    public function test_most_defeated_lists_boss_projects_by_defeat_count(): void
    {
        $this->actingAsAdmin();
        $noBoss = Project::factory()->withoutBoss()->create(['defeat_count' => 500]);
        $defeats = [3, 8, 1, 8, 0, 12];
        $projects = [];
        foreach ($defeats as $count) {
            $projects[] = Project::factory()->create(['defeat_count' => $count]);
        }

        $top = $this->getJson(self::URL)->assertOk()->json('data.most_defeated');

        $this->assertSame(
            [$projects[5]['id'], $projects[1]['id'], $projects[3]['id'], $projects[0]['id'], $projects[2]['id']],
            array_column($top, 'id'),
        );
        $this->assertSame([12, 8, 8, 3, 1], array_column($top, 'defeat_count'));
        $this->assertSame(['id', 'slug', 'title', 'defeat_count'], array_keys($top[0]));
        $this->assertNotContains($noBoss['id'], array_column($top, 'id'));
    }

    public function test_query_count_does_not_grow_with_data(): void
    {
        $this->actingAsAdmin();

        $small = $this->countQueries();

        Project::factory()->count(12)->create(['view_count' => 3, 'defeat_count' => 2]);
        Skill::factory()->count(10)->create();
        Message::factory()->count(15)->create();
        Media::factory()->count(5)->create();

        $this->assertSame($small, $this->countQueries());
        $this->assertSame(4, $small);
    }

    private function countQueries(): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(self::URL)->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    }
}
