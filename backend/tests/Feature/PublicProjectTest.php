<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Project;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicProjectTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/public/projects';

    private const MEDIA_KEYS = ['id', 'url', 'thumb_url', 'mime', 'width', 'height', 'alt', 'blur_data_url', 'dominant_color'];

    private const SUMMARY_KEYS = [
        'id', 'slug', 'title', 'tagline', 'summary', 'category', 'kind', 'progress', 'role', 'team_size',
        'year_start', 'year_end', 'accent_color', 'is_featured', 'sort_order',
        'cover', 'hover_image', 'hover_video', 'peek', 'gallery_count',
        'skills' => ['*' => ['id', 'name', 'slug', 'category', 'level', 'icon_key']],
        'boss' => ['enabled', 'tier', 'name', 'hp', 'sprite', 'intro', 'defeat_text'],
        'live_url', 'repo_url', 'allow_iframe_preview', 'has_video',
    ];

    private function videoMedia(): Media
    {
        return Media::factory()->create([
            'path' => 'media/2026/10/clip.mp4',
            'original_path' => null,
            'thumb_path' => null,
            'mime' => 'video/mp4',
            'width' => null,
            'height' => null,
            'blur_data_url' => null,
            'dominant_color' => null,
        ]);
    }

    public function test_index_lists_only_published_projects_in_sort_order(): void
    {
        Project::factory()->create(['slug' => 'bravo', 'sort_order' => 2]);
        Project::factory()->create(['slug' => 'alpha', 'sort_order' => 0]);
        Project::factory()->draft()->create(['slug' => 'secret', 'sort_order' => 1]);
        Project::factory()->create(['slug' => 'charlie', 'sort_order' => 2]);

        $response = $this->getJson(self::URL)->assertOk()->assertJsonCount(3, 'data');

        $this->assertSame(['alpha', 'bravo', 'charlie'], array_column($response->json('data'), 'slug'));
    }

    public function test_index_filters_by_category_skill_and_search(): void
    {
        $laravel = Skill::factory()->create(['slug' => 'laravel']);
        $hidden = Skill::factory()->hidden()->create(['slug' => 'secret-sauce']);
        $ocr = Project::factory()->create([
            'slug' => 'ocr', 'category' => 'web', 'title' => 'OCR Extraction',
            'tagline' => 'Reads purchase orders', 'summary' => 'Zebracorn pipeline for sales orders.',
        ]);
        $ocr->skills()->attach([$laravel->id => ['sort_order' => 0], $hidden->id => ['sort_order' => 1]]);
        Project::factory()->create([
            'slug' => 'mindlens', 'category' => 'mobile', 'title' => 'Mindlens',
            'tagline' => 'Facial analysis', 'summary' => 'Depression detection.',
        ]);
        $draft = Project::factory()->draft()->create(['slug' => 'draft-ocr', 'category' => 'web', 'title' => 'OCR draft']);
        $draft->skills()->attach($laravel->id);

        $slugs = fn (string $query) => array_column($this->getJson(self::URL.$query)->assertOk()->json('data'), 'slug');

        $this->assertSame(['mindlens'], $slugs('?category=mobile'));
        $this->assertSame(['ocr'], $slugs('?category=web'));
        $this->assertSame(['ocr'], $slugs('?skill=laravel'));
        $this->assertSame([], $slugs('?skill=secret-sauce'));
        $this->assertSame([], $slugs('?skill=unknown'));
        $this->assertSame(['ocr'], $slugs('?q=ocr'));
        $this->assertSame(['ocr'], $slugs('?q=PURCHASE'));
        $this->assertSame(['ocr'], $slugs('?q=zebracorn'));
        $this->assertSame(['mindlens'], $slugs('?q=facial'));
        $this->assertSame(['ocr'], $slugs('?category=web&skill=laravel&q=extraction'));
        $this->assertSame([], $slugs('?category=mobile&skill=laravel'));
        $this->assertSame(['ocr', 'mindlens'], $slugs('?q='));

        $this->getJson(self::URL.'?category=desktop')->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->getJson(self::URL.'?q='.str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');
    }

    public function test_summary_shape_boss_skills_and_previews(): void
    {
        $cover = Media::factory()->create();
        $second = Media::factory()->create();
        $pdf = Media::factory()->pdf()->create();
        $video = $this->videoMedia();
        [$third, $fourth, $fifth] = Media::factory()->count(3)->create()->all();
        [$flutter, $laravel] = Skill::factory()->count(2)->create()->all();
        $hidden = Skill::factory()->hidden()->create();

        $project = Project::factory()->create([
            'title' => 'OCR Extraction', 'boss_name' => null, 'boss_tier' => 'final', 'boss_hp' => 150,
            'boss_intro' => 'A mountain of purchase orders blocks the way.',
            'cover_media_id' => $cover->id, 'video_media_id' => $video->id,
        ]);
        $project->skills()->attach([
            $laravel->id => ['sort_order' => 1],
            $hidden->id => ['sort_order' => 2],
            $flutter->id => ['sort_order' => 0],
        ]);
        $project->gallery()->attach([
            $cover->id => ['sort_order' => 0],
            $pdf->id => ['sort_order' => 1],
            $second->id => ['sort_order' => 2],
            $third->id => ['sort_order' => 3],
            $fourth->id => ['sort_order' => 4],
            $fifth->id => ['sort_order' => 5],
        ]);

        $response = $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonStructure(['data' => ['*' => self::SUMMARY_KEYS]])
            ->assertJsonStructure(['data' => ['*' => ['cover' => self::MEDIA_KEYS, 'peek' => ['*' => self::MEDIA_KEYS]]]])
            ->assertJsonPath('data.0.cover.id', $cover->id)
            ->assertJsonPath('data.0.hover_image.id', $second->id)
            ->assertJsonPath('data.0.hover_video.id', $video->id)
            ->assertJsonPath('data.0.hover_video.mime', 'video/mp4')
            ->assertJsonPath('data.0.gallery_count', 6)
            ->assertJsonPath('data.0.has_video', true)
            ->assertJsonPath('data.0.boss', [
                'enabled' => true,
                'tier' => 'final',
                'name' => 'OCR Extraction',
                'hp' => 150,
                'sprite' => null,
                'intro' => 'A mountain of purchase orders blocks the way.',
                'defeat_text' => null,
            ]);

        $summary = $response->json('data.0');
        $this->assertSame([$cover->id, $second->id, $third->id, $fourth->id], array_column($summary['peek'], 'id'));
        $this->assertSame([$flutter->id, $laravel->id], array_column($summary['skills'], 'id'));
        $this->assertArrayNotHasKey('problem', $summary);
        $this->assertArrayNotHasKey('gallery', $summary);
        $this->assertStringStartsWith('http', $summary['cover']['url']);
    }

    public function test_summary_without_media_and_with_a_named_boss(): void
    {
        $sprite = Media::factory()->create();
        Project::factory()->create([
            'boss_name' => 'The Template Slime', 'boss_tier' => 'minion', 'boss_hp' => 50,
            'boss_media_id' => $sprite->id, 'video_url' => null,
        ]);
        Project::factory()->withoutBoss()->create(['video_url' => 'https://youtu.be/dQw4w9WgXcQ', 'sort_order' => 1]);

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.0.cover', null)
            ->assertJsonPath('data.0.hover_image', null)
            ->assertJsonPath('data.0.hover_video', null)
            ->assertJsonPath('data.0.peek', [])
            ->assertJsonPath('data.0.gallery_count', 0)
            ->assertJsonPath('data.0.skills', [])
            ->assertJsonPath('data.0.has_video', false)
            ->assertJsonPath('data.0.boss.name', 'The Template Slime')
            ->assertJsonPath('data.0.boss.sprite.id', $sprite->id)
            ->assertJsonPath('data.1.boss.enabled', false)
            ->assertJsonPath('data.1.has_video', true);
    }

    public function test_hover_image_skips_the_cover_and_non_images(): void
    {
        $cover = Media::factory()->create();
        $video = $this->videoMedia();
        $project = Project::factory()->create(['cover_media_id' => $cover->id]);
        $project->gallery()->attach([$cover->id => ['sort_order' => 0], $video->id => ['sort_order' => 1]]);

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.0.hover_image', null)
            ->assertJsonPath('data.0.hover_video', null)
            ->assertJsonPath('data.0.has_video', false)
            ->assertJsonPath('data.0.gallery_count', 2)
            ->assertJsonCount(1, 'data.0.peek');
    }

    public function test_detail_shape_and_neighbours(): void
    {
        $alpha = Project::factory()->create(['slug' => 'alpha', 'title' => 'Alpha', 'sort_order' => 0, 'accent_color' => '#111111']);
        $og = Media::factory()->create();
        $shot = Media::factory()->create();
        $bravo = Project::factory()->create([
            'slug' => 'bravo', 'sort_order' => 1, 'highlights' => null, 'challenges' => ['Tight deadline'],
            'problem' => 'Manual data entry.', 'og_media_id' => $og->id, 'seo_title' => 'Bravo SEO',
            'video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ]);
        $bravo->gallery()->attach($shot->id, ['device' => 'mobile', 'caption' => 'Checkout', 'sort_order' => 0]);
        Project::factory()->create(['slug' => 'charlie', 'title' => 'Charlie', 'sort_order' => 2, 'accent_color' => '#C6F432']);
        Project::factory()->draft()->create(['slug' => 'draft-between', 'sort_order' => 1]);

        $this->getJson(self::URL.'/bravo')
            ->assertOk()
            ->assertJsonStructure(['data' => array_merge(self::SUMMARY_KEYS, [
                'status', 'problem', 'solution', 'impact', 'description', 'highlights', 'challenges',
                'video_url', 'video', 'gallery' => ['*' => array_merge(self::MEDIA_KEYS, ['device', 'caption'])],
                'seo_title', 'seo_description', 'og_image' => self::MEDIA_KEYS, 'prev', 'next',
            ])])
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.problem', 'Manual data entry.')
            ->assertJsonPath('data.highlights', [])
            ->assertJsonPath('data.challenges', ['Tight deadline'])
            ->assertJsonPath('data.video', null)
            ->assertJsonPath('data.has_video', true)
            ->assertJsonPath('data.gallery.0.id', $shot->id)
            ->assertJsonPath('data.gallery.0.device', 'mobile')
            ->assertJsonPath('data.gallery.0.caption', 'Checkout')
            ->assertJsonPath('data.og_image.id', $og->id)
            ->assertJsonPath('data.seo_title', 'Bravo SEO')
            ->assertJsonPath('data.prev', ['slug' => 'alpha', 'title' => 'Alpha', 'accent_color' => '#111111'])
            ->assertJsonPath('data.next', ['slug' => 'charlie', 'title' => 'Charlie', 'accent_color' => '#C6F432']);

        $this->getJson(self::URL.'/alpha')->assertOk()->assertJsonPath('data.prev', null)->assertJsonPath('data.next.slug', 'bravo');
        $this->getJson(self::URL.'/charlie')->assertOk()->assertJsonPath('data.prev.slug', 'bravo')->assertJsonPath('data.next', null);
        $this->getJson(self::URL.'/nope')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
        $this->assertSame($alpha->id, $this->getJson(self::URL.'/alpha')->json('data.id'));
    }

    public function test_ties_in_sort_order_fall_back_to_id_for_neighbours(): void
    {
        Project::factory()->create(['slug' => 'first', 'sort_order' => 3]);
        Project::factory()->create(['slug' => 'second', 'sort_order' => 3]);
        Project::factory()->create(['slug' => 'third', 'sort_order' => 3]);

        $this->getJson(self::URL.'/second')
            ->assertOk()
            ->assertJsonPath('data.prev.slug', 'first')
            ->assertJsonPath('data.next.slug', 'third');
    }

    public function test_a_draft_is_visible_only_with_an_admin_token(): void
    {
        Project::factory()->draft()->create(['slug' => 'secret-draft']);

        $this->getJson(self::URL.'/secret-draft')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
        $this->assertSame([], $this->getJson(self::URL)->json('data'));
        $this->withToken('hk_not-a-real-token')->getJson(self::URL.'/secret-draft')->assertNotFound();

        $token = User::factory()->create()->createToken('admin')->plainTextToken;

        $this->withToken($token)
            ->getJson(self::URL.'/secret-draft')
            ->assertOk()
            ->assertJsonPath('data.slug', 'secret-draft')
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_view_increments_the_counter_without_touching_updated_at(): void
    {
        $project = Project::factory()->create(['slug' => 'counted', 'updated_at' => '2026-01-01 00:00:00']);
        Project::factory()->draft()->create(['slug' => 'hidden']);

        $this->postJson(self::URL.'/counted/view')->assertOk()->assertExactJson(['data' => ['view_count' => 1]]);
        $this->postJson(self::URL.'/counted/view')->assertOk()->assertExactJson(['data' => ['view_count' => 2]]);

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'view_count' => 2, 'updated_at' => '2026-01-01 00:00:00']);

        $this->postJson(self::URL.'/hidden/view')->assertNotFound();
        $this->postJson(self::URL.'/unknown/view')->assertNotFound();
        $this->assertDatabaseHas('projects', ['slug' => 'hidden', 'view_count' => 0]);
    }

    public function test_defeat_increments_the_counter(): void
    {
        Project::factory()->create(['slug' => 'boss']);
        Project::factory()->withoutBoss()->create(['slug' => 'peaceful']);
        Project::factory()->draft()->create(['slug' => 'draft-boss']);
        Project::factory()->draft()->withoutBoss()->create(['slug' => 'draft-peaceful']);

        $this->postJson(self::URL.'/boss/defeat')->assertOk()->assertExactJson(['data' => ['defeat_count' => 1]]);
        $this->postJson(self::URL.'/boss/defeat')->assertOk()->assertExactJson(['data' => ['defeat_count' => 2]]);

        $this->postJson(self::URL.'/peaceful/defeat')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This project has no boss.');
        $this->postJson(self::URL.'/draft-boss/defeat')->assertNotFound();
        $this->postJson(self::URL.'/draft-peaceful/defeat')->assertNotFound();
        $this->postJson(self::URL.'/unknown/defeat')->assertNotFound();

        $this->assertDatabaseHas('projects', ['slug' => 'peaceful', 'defeat_count' => 0]);
        $this->assertDatabaseHas('projects', ['slug' => 'draft-boss', 'defeat_count' => 0]);
    }

    public function test_list_and_detail_run_a_fixed_number_of_queries(): void
    {
        $this->fullProject('p-1');
        $oneProject = $this->countQueries(fn () => $this->getJson(self::URL)->assertJsonCount(1, 'data'));
        $detailOf = fn (string $slug) => $this->countQueries(fn () => $this->getJson(self::URL.'/'.$slug)->assertOk());
        $smallDetail = $detailOf('p-1');

        $this->fullProject('p-2', 6);
        $this->fullProject('p-3', 6);
        $this->fullProject('p-4', 6);

        $this->assertSame($oneProject, $this->countQueries(fn () => $this->getJson(self::URL)->assertJsonCount(4, 'data')));
        $this->assertSame($smallDetail, $detailOf('p-3'));
        // projects + 5 eager loads (cover, video, boss sprite, gallery, skills); detail adds og + prev + next.
        $this->assertLessThanOrEqual(6, $oneProject);
        $this->assertLessThanOrEqual(9, $smallDetail);
    }

    private function fullProject(string $slug, int $items = 1): Project
    {
        $project = Project::factory()->create([
            'slug' => $slug,
            'cover_media_id' => Media::factory()->create()->id,
            'boss_media_id' => Media::factory()->create()->id,
            'og_media_id' => Media::factory()->create()->id,
            'video_media_id' => $this->videoMedia()->id,
        ]);
        $project->skills()->attach(Skill::factory()->count($items)->create()->modelKeys());
        $project->gallery()->attach(Media::factory()->count($items)->create()->modelKeys());

        return $project;
    }

    private function countQueries(callable $callback): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $callback();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    public function test_view_and_defeat_are_throttled_per_ip(): void
    {
        Project::factory()->create(['slug' => 'popular']);

        for ($i = 1; $i <= 30; $i++) {
            $this->postJson(self::URL.'/popular/view')->assertOk();
        }

        $this->postJson(self::URL.'/popular/view')->assertTooManyRequests();
        $this->assertDatabaseHas('projects', ['slug' => 'popular', 'view_count' => 30]);

        // Defeat has its own budget: exhausted views do not block it.
        for ($i = 1; $i <= 30; $i++) {
            $this->postJson(self::URL.'/popular/defeat')->assertOk();
        }
        $this->postJson(self::URL.'/popular/defeat')->assertTooManyRequests();
        $this->assertDatabaseHas('projects', ['slug' => 'popular', 'defeat_count' => 30]);
    }

    public function test_interleaved_view_and_defeat_do_not_share_a_bucket(): void
    {
        Project::factory()->create(['slug' => 'popular']);

        for ($i = 1; $i <= 30; $i++) {
            $this->postJson(self::URL.'/popular/view')->assertOk();
            $this->postJson(self::URL.'/popular/defeat')->assertOk();
        }

        $this->assertDatabaseHas('projects', ['slug' => 'popular', 'view_count' => 30, 'defeat_count' => 30]);
    }
}
