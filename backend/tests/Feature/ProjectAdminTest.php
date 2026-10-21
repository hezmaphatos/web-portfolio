<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Project;
use App\Models\Skill;
use App\Services\RevalidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Mockery\MockInterface;
use Tests\TestCase;

class ProjectAdminTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/projects';

    protected function setUp(): void
    {
        parent::setUp();

        // The revalidation webhook runs after each write; never let it leave the test.
        Http::fake();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Mindlens',
            'tagline' => 'Spotting signs of depression with facial analysis.',
            'category' => 'mobile',
            'kind' => 'personal',
            'progress' => 'shipped',
            'status' => 'published',
            'summary' => 'Mobile app that uses machine learning and facial analysis.',
            'accent_color' => '#3D5AFE',
        ], $overrides);
    }

    public function test_guests_are_rejected(): void
    {
        $project = Project::factory()->create();

        $this->getJson(self::URL)->assertUnauthorized();
        $this->getJson(self::URL.'/'.$project->id)->assertUnauthorized();
        $this->postJson(self::URL, $this->payload())->assertUnauthorized();
        $this->putJson(self::URL.'/'.$project->id, ['title' => 'Hacked'])->assertUnauthorized();
        $this->deleteJson(self::URL.'/'.$project->id)->assertUnauthorized();
        $this->postJson(self::URL.'/reorder', ['items' => [['id' => $project->id, 'sort_order' => 3]]])->assertUnauthorized();

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'title' => $project->title]);
    }

    public function test_store_creates_a_project_with_ordered_skills_and_gallery(): void
    {
        $this->actingAsAdmin();
        Project::factory()->create(['sort_order' => 4]);
        [$laravel, $mysql, $python] = Skill::factory()->count(3)->create()->all();
        [$first, $second] = Media::factory()->count(2)->create()->all();

        $response = $this->postJson(self::URL, $this->payload([
            'skill_ids' => [$python->id, $laravel->id, $mysql->id],
            'gallery' => [
                ['media_id' => $second->id, 'device' => 'mobile', 'caption' => 'Home screen'],
                ['media_id' => $first->id],
            ],
            'highlights' => ['Face analysis on device'],
            'cover_media_id' => $first->id,
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.slug', 'mindlens')
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.sort_order', 5)
            ->assertJsonPath('data.skill_ids', [$python->id, $laravel->id, $mysql->id])
            ->assertJsonPath('data.skills.0.id', $python->id)
            ->assertJsonPath('data.skills.2.id', $mysql->id)
            ->assertJsonPath('data.gallery.0.media_id', $second->id)
            ->assertJsonPath('data.gallery.0.device', 'mobile')
            ->assertJsonPath('data.gallery.0.caption', 'Home screen')
            ->assertJsonPath('data.gallery.0.media.id', $second->id)
            ->assertJsonPath('data.gallery.1.media_id', $first->id)
            ->assertJsonPath('data.gallery.1.device', 'desktop')
            ->assertJsonPath('data.gallery.1.caption', null)
            ->assertJsonPath('data.cover.id', $first->id)
            ->assertJsonPath('data.highlights', ['Face analysis on device'])
            ->assertJsonPath('data.challenges', [])
            ->assertJsonPath('data.boss_enabled', true)
            ->assertJsonPath('data.boss_sprite', null)
            ->assertJsonPath('data.view_count', 0)
            ->assertJsonStructure(['data' => [
                'id', 'slug', 'title', 'tagline', 'category', 'kind', 'progress', 'status', 'role', 'team_size',
                'year_start', 'year_end', 'accent_color', 'is_featured', 'sort_order',
                'summary', 'problem', 'solution', 'impact', 'description', 'highlights', 'challenges',
                'skill_ids', 'skills' => ['*' => ['id', 'name', 'slug', 'category', 'level', 'icon_key']],
                'boss_enabled', 'boss_tier', 'boss_hp', 'boss_name', 'boss_media_id', 'boss_sprite',
                'boss_intro', 'boss_defeat_text',
                'cover_media_id', 'cover' => ['id', 'url', 'thumb_url', 'mime', 'width', 'height', 'alt', 'blur_data_url', 'dominant_color'],
                'gallery' => ['*' => ['media_id', 'device', 'caption', 'media']],
                'video_url', 'video_media_id', 'video',
                'live_url', 'repo_url', 'allow_iframe_preview',
                'seo_title', 'seo_description', 'og_media_id', 'og_image',
                'view_count', 'defeat_count', 'created_at', 'updated_at',
            ]]);

        $id = $response->json('data.id');
        $this->assertDatabaseHas('project_skill', ['project_id' => $id, 'skill_id' => $python->id, 'sort_order' => 0]);
        $this->assertDatabaseHas('project_skill', ['project_id' => $id, 'skill_id' => $laravel->id, 'sort_order' => 1]);
        $this->assertDatabaseHas('project_skill', ['project_id' => $id, 'skill_id' => $mysql->id, 'sort_order' => 2]);
        $this->assertDatabaseHas('project_media', ['project_id' => $id, 'media_id' => $second->id, 'sort_order' => 0, 'device' => 'mobile']);
        $this->assertDatabaseHas('project_media', ['project_id' => $id, 'media_id' => $first->id, 'sort_order' => 1, 'device' => 'desktop']);
    }

    public function test_first_project_without_sort_order_starts_at_zero(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload())->assertCreated()->assertJsonPath('data.sort_order', 0);
        $this->postJson(self::URL, $this->payload(['sort_order' => 9]))->assertCreated()->assertJsonPath('data.sort_order', 9);
    }

    public function test_slug_is_generated_from_the_title_and_kept_unique(): void
    {
        $this->actingAsAdmin();
        Project::factory()->create(['title' => 'My Game', 'slug' => 'my-game']);

        $this->postJson(self::URL, $this->payload(['title' => 'My Game', 'slug' => null]))
            ->assertCreated()->assertJsonPath('data.slug', 'my-game-2');
        $this->postJson(self::URL, $this->payload(['title' => 'My Game']))
            ->assertCreated()->assertJsonPath('data.slug', 'my-game-3');
        $this->postJson(self::URL, $this->payload(['title' => 'OCR — Internal Document Extraction']))
            ->assertCreated()->assertJsonPath('data.slug', 'ocr-internal-document-extraction');

        $this->postJson(self::URL, $this->payload(['title' => 'Other', 'slug' => 'my-game']))
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->postJson(self::URL, $this->payload(['slug' => 'Bad_Slug']))
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->postJson(self::URL, $this->payload(['slug' => 'double--dash']))
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    public function test_update_keeps_its_own_slug_and_regenerates_an_empty_one(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create(['title' => 'Radioactive', 'slug' => 'radioactive']);
        Project::factory()->create(['title' => 'Ark Care', 'slug' => 'ark-care']);

        $this->putJson(self::URL.'/'.$project->id, ['slug' => 'radioactive'])
            ->assertOk()->assertJsonPath('data.slug', 'radioactive');
        $this->putJson(self::URL.'/'.$project->id, ['slug' => 'ark-care'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->putJson(self::URL.'/'.$project->id, ['title' => 'Ark Care', 'slug' => ''])
            ->assertOk()->assertJsonPath('data.slug', 'ark-care-2');
    }

    public function test_boss_hp_defaults_to_the_tier_preset(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload(['boss_tier' => 'minion']))
            ->assertCreated()->assertJsonPath('data.boss_tier', 'minion')->assertJsonPath('data.boss_hp', 50);
        $this->postJson(self::URL, $this->payload(['boss_tier' => 'final']))
            ->assertCreated()->assertJsonPath('data.boss_hp', 150);
        $this->postJson(self::URL, $this->payload())
            ->assertCreated()->assertJsonPath('data.boss_tier', 'regular')->assertJsonPath('data.boss_hp', 100);
        $this->postJson(self::URL, $this->payload(['boss_tier' => 'final', 'boss_hp' => 77]))
            ->assertCreated()->assertJsonPath('data.boss_hp', 77);
    }

    public function test_boss_fields_are_validated_at_the_boundaries(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload(['boss_hp' => 9]))
            ->assertUnprocessable()->assertJsonValidationErrors('boss_hp');
        $this->postJson(self::URL, $this->payload(['boss_hp' => 301]))
            ->assertUnprocessable()->assertJsonValidationErrors('boss_hp');
        $this->postJson(self::URL, $this->payload(['boss_tier' => 'mega']))
            ->assertUnprocessable()->assertJsonValidationErrors('boss_tier');
        $this->postJson(self::URL, $this->payload(['boss_name' => str_repeat('x', 81)]))
            ->assertUnprocessable()->assertJsonValidationErrors('boss_name');

        $this->postJson(self::URL, $this->payload(['boss_hp' => 10]))->assertCreated();
        $this->postJson(self::URL, $this->payload(['boss_hp' => 300]))->assertCreated();
    }

    public function test_video_url_must_be_a_youtube_link(): void
    {
        $this->actingAsAdmin();

        foreach ([
            'https://vimeo.com/123456789',
            'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
            'https://www.youtube.com/channel/UC123456',
            'not a url',
        ] as $url) {
            $this->postJson(self::URL, $this->payload(['video_url' => $url]))
                ->assertUnprocessable()->assertJsonValidationErrors('video_url');
        }

        foreach ([
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ',
            'https://www.youtube.com/shorts/dQw4w9WgXcQ',
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        ] as $url) {
            $this->postJson(self::URL, $this->payload(['video_url' => $url]))
                ->assertCreated()->assertJsonPath('data.video_url', $url);
        }
    }

    public function test_unknown_skills_and_gallery_media_are_rejected(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create();
        $media = Media::factory()->create();

        $this->postJson(self::URL, $this->payload(['skill_ids' => [$skill->id, 999]]))
            ->assertUnprocessable()->assertJsonValidationErrors('skill_ids');
        $this->postJson(self::URL, $this->payload(['gallery' => [['media_id' => $media->id], ['media_id' => 999]]]))
            ->assertUnprocessable()->assertJsonValidationErrors('gallery');
        $this->postJson(self::URL, $this->payload(['skill_ids' => [$skill->id, $skill->id]]))
            ->assertUnprocessable()->assertJsonValidationErrors('skill_ids.0');
        $this->postJson(self::URL, $this->payload(['gallery' => [['media_id' => $media->id, 'device' => 'watch']]]))
            ->assertUnprocessable()->assertJsonValidationErrors('gallery.0.device');

        $this->assertDatabaseCount('projects', 0);
    }

    public function test_other_fields_are_validated(): void
    {
        $this->actingAsAdmin();
        $pdf = Media::factory()->pdf()->create();
        $image = Media::factory()->create();

        $invalid = [
            'title' => ['title' => ''],
            'category' => ['category' => 'desktop'],
            'kind' => ['kind' => 'hobby'],
            'accent_color' => ['accent_color' => '#12345'],
            'team_size' => ['team_size' => 0],
            'year_start' => ['year_start' => 1989],
            'year_end' => ['year_start' => 2025, 'year_end' => 2024],
            'live_url' => ['live_url' => 'javascript:alert(1)'],
            'repo_url' => ['repo_url' => 'https://example.com/'.str_repeat('a', 500)],
            'highlights.0' => ['highlights' => [str_repeat('a', 501)]],
            'cover_media_id' => ['cover_media_id' => $pdf->id],
            'video_media_id' => ['video_media_id' => $image->id],
        ];

        foreach ($invalid as $field => $overrides) {
            $this->postJson(self::URL, $this->payload($overrides))
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }

        $this->postJson(self::URL, $this->payload(['year_end' => 2026, 'team_size' => 5, 'accent_color' => '#c6f432']))
            ->assertCreated()->assertJsonPath('data.year_end', 2026)->assertJsonPath('data.team_size', 5);
    }

    public function test_published_projects_need_a_summary(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload(['summary' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('summary');

        $id = $this->postJson(self::URL, $this->payload(['status' => 'draft', 'summary' => null]))
            ->assertCreated()->json('data.id');

        $this->putJson(self::URL.'/'.$id, ['status' => 'published'])
            ->assertUnprocessable()->assertJsonValidationErrors('summary');
        $this->putJson(self::URL.'/'.$id, ['status' => 'published', 'summary' => 'Now it has one.'])
            ->assertOk()->assertJsonPath('data.status', 'published');
        $this->putJson(self::URL.'/'.$id, ['summary' => null])
            ->assertUnprocessable()->assertJsonValidationErrors('summary');
    }

    public function test_update_resyncs_skills_and_gallery_in_the_new_order(): void
    {
        $this->actingAsAdmin();
        [$a, $b, $c] = Skill::factory()->count(3)->create()->all();
        [$m1, $m2, $m3] = Media::factory()->count(3)->create()->all();

        $id = $this->postJson(self::URL, $this->payload([
            'skill_ids' => [$a->id, $b->id],
            'gallery' => [['media_id' => $m1->id], ['media_id' => $m2->id]],
        ]))->assertCreated()->json('data.id');

        $this->putJson(self::URL.'/'.$id, $this->payload([
            'title' => 'Mindlens v2',
            'skill_ids' => [$c->id, $b->id],
            'gallery' => [
                ['media_id' => $m3->id, 'device' => 'tablet'],
                ['media_id' => $m2->id, 'caption' => 'Results'],
            ],
        ]))
            ->assertOk()
            ->assertJsonPath('data.title', 'Mindlens v2')
            ->assertJsonPath('data.slug', 'mindlens')
            ->assertJsonPath('data.skill_ids', [$c->id, $b->id])
            ->assertJsonPath('data.gallery.0.media_id', $m3->id)
            ->assertJsonPath('data.gallery.0.device', 'tablet')
            ->assertJsonPath('data.gallery.1.media_id', $m2->id)
            ->assertJsonPath('data.gallery.1.caption', 'Results');

        $this->assertDatabaseMissing('project_skill', ['project_id' => $id, 'skill_id' => $a->id]);
        $this->assertDatabaseHas('project_skill', ['project_id' => $id, 'skill_id' => $c->id, 'sort_order' => 0]);
        $this->assertDatabaseHas('project_skill', ['project_id' => $id, 'skill_id' => $b->id, 'sort_order' => 1]);
        $this->assertDatabaseMissing('project_media', ['project_id' => $id, 'media_id' => $m1->id]);
        $this->assertDatabaseHas('project_media', ['project_id' => $id, 'media_id' => $m2->id, 'sort_order' => 1, 'caption' => 'Results']);

        // Lists that are not sent stay as they are; an empty list clears.
        $this->putJson(self::URL.'/'.$id, ['is_featured' => true])
            ->assertOk()->assertJsonPath('data.is_featured', true)->assertJsonPath('data.skill_ids', [$c->id, $b->id]);
        $this->putJson(self::URL.'/'.$id, ['skill_ids' => [], 'gallery' => []])
            ->assertOk()->assertJsonPath('data.skill_ids', [])->assertJsonPath('data.gallery', []);
    }

    public function test_partial_update_checks_years_against_the_stored_row(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create(['year_start' => 2025, 'year_end' => null]);

        $this->putJson(self::URL.'/'.$project->id, ['year_end' => 2024])
            ->assertUnprocessable()->assertJsonValidationErrors('year_end');
        $this->putJson(self::URL.'/'.$project->id, ['year_end' => 2026])
            ->assertOk()->assertJsonPath('data.year_end', 2026);
        $this->putJson(self::URL.'/'.$project->id, ['year_start' => 2027])
            ->assertUnprocessable()->assertJsonValidationErrors('year_end');
    }

    public function test_update_with_null_boss_hp_uses_the_tier_preset(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create(['boss_tier' => 'regular', 'boss_hp' => 80]);

        $this->putJson(self::URL.'/'.$project->id, ['boss_tier' => 'final'])
            ->assertOk()->assertJsonPath('data.boss_hp', 80);
        $this->putJson(self::URL.'/'.$project->id, ['boss_hp' => null])
            ->assertOk()->assertJsonPath('data.boss_hp', 150);
    }

    public function test_writes_revalidate_the_project_tags(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create(['title' => 'Old', 'slug' => 'old-slug']);

        $this->mock(RevalidationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('revalidateProjects')->once()->with(['new-slug', 'old-slug']);
            $mock->shouldReceive('revalidateProjects')->once()->with(['new-slug']);
            $mock->shouldReceive('revalidateProjects')->once()->with(['mindlens']);
        });

        $this->putJson(self::URL.'/'.$project->id, ['slug' => 'new-slug'])
            ->assertOk()->assertJsonPath('data.slug', 'new-slug');
        $this->putJson(self::URL.'/'.$project->id, ['title' => 'Renamed title only'])->assertOk();
        $this->postJson(self::URL, $this->payload())->assertCreated();
    }

    public function test_destroy_deletes_the_project_and_its_pivots(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create(['slug' => 'doomed']);
        $skill = Skill::factory()->create();
        $media = Media::factory()->create();
        $project->skills()->attach($skill->id, ['sort_order' => 0]);
        $project->gallery()->attach($media->id, ['device' => 'desktop', 'sort_order' => 0]);

        $this->mock(RevalidationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('revalidateProjects')->once()->with(['doomed']);
        });

        $this->deleteJson(self::URL.'/'.$project->id)->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
        $this->assertDatabaseMissing('project_skill', ['project_id' => $project->id]);
        $this->assertDatabaseMissing('project_media', ['project_id' => $project->id]);
        $this->assertDatabaseHas('skills', ['id' => $skill->id]);
        $this->assertDatabaseHas('media', ['id' => $media->id]);

        $this->deleteJson(self::URL.'/'.$project->id)->assertNotFound();
    }

    public function test_reorder_updates_sort_order(): void
    {
        $this->actingAsAdmin();
        [$a, $b, $c] = Project::factory()->count(3)->sequence(
            ['sort_order' => 0], ['sort_order' => 1], ['sort_order' => 2],
        )->create()->all();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $c->id, 'sort_order' => 0],
            ['id' => $a->id, 'sort_order' => 1],
            ['id' => $b->id, 'sort_order' => 2],
        ]])->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertSame([$c->id, $a->id, $b->id], array_column($this->getJson(self::URL)->json('data'), 'id'));

        $this->postJson(self::URL.'/reorder', ['items' => [['id' => 999, 'sort_order' => 0]]])
            ->assertUnprocessable()->assertJsonValidationErrors('items');
    }

    public function test_index_lists_every_project_with_counts(): void
    {
        $this->actingAsAdmin();
        $cover = Media::factory()->create();
        $published = Project::factory()->create(['sort_order' => 1, 'cover_media_id' => $cover->id]);
        $draft = Project::factory()->draft()->create(['sort_order' => 0]);
        $published->skills()->attach(Skill::factory()->count(2)->create()->modelKeys());
        $published->gallery()->attach(Media::factory()->count(3)->create()->modelKeys());

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $draft->id)
            ->assertJsonPath('data.0.status', 'draft')
            ->assertJsonPath('data.0.skills_count', 0)
            ->assertJsonPath('data.0.cover', null)
            ->assertJsonPath('data.1.id', $published->id)
            ->assertJsonPath('data.1.skills_count', 2)
            ->assertJsonPath('data.1.gallery_count', 3)
            ->assertJsonPath('data.1.cover.id', $cover->id)
            ->assertJsonStructure(['data' => ['*' => [
                'id', 'slug', 'title', 'status', 'category', 'kind', 'is_featured', 'accent_color', 'cover',
                'skills_count', 'gallery_count', 'boss_enabled', 'boss_tier', 'boss_hp', 'view_count',
                'defeat_count', 'sort_order', 'updated_at',
            ]]]);
    }

    public function test_index_query_count_does_not_grow_with_rows(): void
    {
        $this->actingAsAdmin();
        $make = fn () => Project::factory()->create(['cover_media_id' => Media::factory()->create()->id])
            ->skills()->attach(Skill::factory()->count(2)->create()->modelKeys());

        $make();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(self::URL)->assertJsonCount(1, 'data');
        $one = count(DB::getQueryLog());

        $make();
        $make();
        DB::flushQueryLog();
        $this->getJson(self::URL)->assertJsonCount(3, 'data');
        $three = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame($one, $three);
    }

    public function test_show_returns_404_for_an_unknown_project(): void
    {
        $this->actingAsAdmin();

        $this->getJson(self::URL.'/999')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
        $this->putJson(self::URL.'/999', $this->payload())->assertNotFound();
    }

    public function test_saving_skills_and_gallery_runs_a_fixed_number_of_queries(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create();
        $skills = Skill::factory()->count(20)->create()->modelKeys();
        $media = Media::factory()->count(8)->create()->modelKeys();

        $count = function (array $skillIds, array $mediaIds) use ($project): int {
            $gallery = array_map(fn (int $id) => ['media_id' => $id, 'device' => 'mobile'], $mediaIds);

            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->putJson(self::URL.'/'.$project->id, ['skill_ids' => $skillIds, 'gallery' => $gallery])->assertOk();
            $queries = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $queries;
        };

        $small = $count(array_slice($skills, 0, 2), array_slice($media, 0, 2));
        $large = $count($skills, $media);
        // Re-saving the same lists in reverse order (every row an existing pivot) costs the same.
        $reordered = $count(array_reverse($skills), array_reverse($media));

        $this->assertSame($small, $large);
        $this->assertSame($small, $reordered);
        $this->assertDatabaseHas('project_skill', ['project_id' => $project->id, 'skill_id' => $skills[19], 'sort_order' => 0]);
        $this->assertDatabaseHas('project_media', ['project_id' => $project->id, 'media_id' => $media[7], 'sort_order' => 0]);
        $this->assertSame(20, DB::table('project_skill')->where('project_id', $project->id)->count());
    }

    public function test_gallery_items_must_be_images(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create();
        $image = Media::factory()->create();
        $pdf = Media::factory()->pdf()->create();
        $video = Media::factory()->create(['mime' => 'video/mp4', 'width' => null, 'height' => null]);

        $this->putJson(self::URL.'/'.$project->id, ['gallery' => [['media_id' => $image->id], ['media_id' => $pdf->id]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['gallery' => 'Gallery items must be existing images.']);
        $this->putJson(self::URL.'/'.$project->id, ['gallery' => [['media_id' => $video->id]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('gallery');

        $this->assertDatabaseCount('project_media', 0);
    }

    public function test_highlights_and_challenges_must_be_lists(): void
    {
        $this->actingAsAdmin();
        $project = Project::factory()->create();

        $this->putJson(self::URL.'/'.$project->id, ['highlights' => ['a' => 'x', 'b' => 'y']])
            ->assertUnprocessable()->assertJsonValidationErrors('highlights');
        $this->putJson(self::URL.'/'.$project->id, ['challenges' => ['first' => 'x']])
            ->assertUnprocessable()->assertJsonValidationErrors('challenges');

        $this->putJson(self::URL.'/'.$project->id, ['highlights' => ['Shipped it'], 'challenges' => null])
            ->assertOk()
            ->assertJsonPath('data.highlights', ['Shipped it'])
            ->assertJsonPath('data.challenges', []);
    }
}
