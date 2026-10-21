<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\Project;
use App\Models\Skill;
use App\Services\RevalidationService;
use App\Services\SkillService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SkillTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/skills';

    private const PUBLIC_KEYS = [
        'id', 'name', 'slug', 'category', 'level', 'status', 'icon_key', 'icon', 'description',
        'attack_name', 'damage', 'cooldown_ms', 'sort_order',
    ];

    private const ADMIN_KEYS = [
        ...self::PUBLIC_KEYS,
        'is_visible', 'icon_media_id', 'projects_count', 'dps', 'dps_warning', 'created_at', 'updated_at',
    ];

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Laravel',
            'category' => 'backend',
            'level' => 5,
            'status' => 'core',
            'icon_key' => 'laravel',
            'description' => null,
            'attack_name' => 'Eloquent Slam',
            'damage' => 70,
            'cooldown_ms' => 4000,
            'is_visible' => true,
        ], $overrides);
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $skill = Skill::factory()->create();

        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::URL, $this->payload())->assertUnauthorized();
        $this->getJson(self::URL.'/'.$skill->id)->assertUnauthorized();
        $this->putJson(self::URL.'/'.$skill->id, $this->payload())->assertUnauthorized();
        $this->deleteJson(self::URL.'/'.$skill->id)->assertUnauthorized();
        $this->postJson(self::URL.'/reorder', ['items' => [['id' => $skill->id, 'sort_order' => 1]]])->assertUnauthorized();

        $this->assertDatabaseHas('skills', ['id' => $skill->id, 'sort_order' => 0]);
    }

    public function test_index_returns_every_skill_ordered_with_counts_and_dps(): void
    {
        $this->actingAsAdmin();
        $icon = Media::factory()->create();
        $second = Skill::factory()->create(['sort_order' => 1, 'damage' => 70, 'cooldown_ms' => 4000, 'icon_media_id' => $icon->id]);
        $first = Skill::factory()->hidden()->create(['sort_order' => 0]);
        $soft = Skill::factory()->soft()->create(['sort_order' => 1]);
        Project::factory()->create()->skills()->attach($second->id, ['sort_order' => 0]);
        Project::factory()->create()->skills()->attach($second->id, ['sort_order' => 3]);

        $response = $this->getJson(self::URL)->assertOk();

        $this->assertSame([$first->id, $second->id, $soft->id], array_column($response->json('data'), 'id'));
        $response->assertJsonStructure(['data' => ['*' => self::ADMIN_KEYS]])
            ->assertJsonPath('data.0.is_visible', false)
            ->assertJsonPath('data.0.projects_count', 0)
            ->assertJsonPath('data.1.projects_count', 2)
            ->assertJsonPath('data.1.dps', 17.5)
            ->assertJsonPath('data.1.dps_warning', null)
            ->assertJsonPath('data.1.icon_media_id', $icon->id)
            ->assertJsonPath('data.1.icon.id', $icon->id)
            ->assertJsonPath('data.1.icon.mime', 'image/webp')
            ->assertJsonPath('data.0.icon', null)
            ->assertJsonPath('data.2.dps', null)
            ->assertJsonPath('data.2.dps_warning', null)
            ->assertJsonPath('data.2.damage', null);
    }

    /**
     * @return array<string, array{int, int, float, string|null}>
     */
    public static function dpsCases(): array
    {
        return [
            'balanced' => [70, 4000, 17.5, null],
            'one decimal' => [55, 3000, 18.3, null],
            'exactly 30 is fine' => [60, 2000, 30.0, null],
            'exactly 15 is fine' => [30, 2000, 15.0, null],
            'strong' => [70, 2000, 35.0, 'strong'],
            'weak' => [25, 2000, 12.5, 'weak'],
        ];
    }

    #[DataProvider('dpsCases')]
    public function test_dps_and_warning(int $damage, int $cooldown, float $dps, ?string $warning): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create(['damage' => $damage, 'cooldown_ms' => $cooldown]);

        $response = $this->getJson(self::URL.'/'.$skill->id)->assertOk();

        $this->assertEqualsWithDelta($dps, $response->json('data.dps'), 0.0001);
        $this->assertSame($warning, $response->json('data.dps_warning'));
    }

    public function test_show_returns_the_admin_row_and_404_for_unknown_ids(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create(['name' => 'PHP', 'slug' => 'php']);

        $this->getJson(self::URL.'/'.$skill->id)
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.slug', 'php')
            ->assertJsonPath('data.projects_count', 0);

        $this->getJson(self::URL.'/999999')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
    }

    public function test_store_creates_a_skill_with_an_auto_slug_and_puts_it_last(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['sort_order' => 4]);
        Skill::factory()->create(['sort_order' => 7]);
        $icon = Media::factory()->create();

        $this->mock(RevalidationService::class)->shouldReceive('revalidateAll')->once();

        $response = $this->postJson(self::URL, $this->payload(['icon_media_id' => $icon->id]))
            ->assertCreated()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.name', 'Laravel')
            ->assertJsonPath('data.slug', 'laravel')
            ->assertJsonPath('data.level', 5)
            ->assertJsonPath('data.damage', 70)
            ->assertJsonPath('data.cooldown_ms', 4000)
            ->assertJsonPath('data.sort_order', 8)
            ->assertJsonPath('data.icon.id', $icon->id)
            ->assertJsonPath('data.dps', 17.5);

        $this->assertDatabaseHas('skills', [
            'id' => $response->json('data.id'),
            'slug' => 'laravel',
            'attack_name' => 'Eloquent Slam',
            'sort_order' => 8,
        ]);
    }

    public function test_store_applies_defaults_for_omitted_optional_fields(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, [
            'name' => 'Go',
            'category' => 'backend',
            'attack_name' => 'Goroutine',
            'damage' => 40,
            'cooldown_ms' => 2000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.level', 3)
            ->assertJsonPath('data.status', 'core')
            ->assertJsonPath('data.is_visible', true)
            ->assertJsonPath('data.sort_order', 0)
            ->assertJsonPath('data.icon', null);
    }

    public function test_store_keeps_an_explicit_sort_order(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['sort_order' => 9]);

        $this->postJson(self::URL, $this->payload(['sort_order' => 2]))
            ->assertCreated()
            ->assertJsonPath('data.sort_order', 2);
    }

    public function test_auto_slug_gets_a_numeric_suffix_when_taken(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['name' => 'Laravel', 'slug' => 'laravel']);
        Skill::factory()->create(['name' => 'Laravel 2', 'slug' => 'laravel-2']);
        Skill::factory()->create(['name' => 'Laravel Echo', 'slug' => 'laravel-echo']);

        $this->postJson(self::URL, $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.slug', 'laravel-3');

        $this->postJson(self::URL, $this->payload(['name' => 'Tailwind CSS']))
            ->assertCreated()
            ->assertJsonPath('data.slug', 'tailwind-css');
    }

    public function test_explicit_slug_must_be_unique_and_alpha_dash(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['slug' => 'laravel']);

        $this->postJson(self::URL, $this->payload(['slug' => 'laravel']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');

        $this->postJson(self::URL, $this->payload(['slug' => 'not a slug!']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');

        $this->postJson(self::URL, $this->payload(['slug' => 'eloquent']))
            ->assertCreated()
            ->assertJsonPath('data.slug', 'eloquent');
    }

    public function test_store_validates_required_fields_and_enums(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'category', 'attack_name', 'damage', 'cooldown_ms']);

        $this->postJson(self::URL, $this->payload([
            'name' => str_repeat('a', 81),
            'category' => 'cooking',
            'level' => 6,
            'status' => 'expert',
            'attack_name' => str_repeat('a', 61),
            'icon_media_id' => 999999,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'category', 'level', 'status', 'attack_name', 'icon_media_id']);

        $this->postJson(self::URL, $this->payload(['level' => 0]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('level');

        $this->assertDatabaseCount('skills', 0);
    }

    /**
     * @return array<string, array{string, int, bool}>
     */
    public static function gameFieldBoundaries(): array
    {
        return [
            'damage 24' => ['damage', 24, false],
            'damage 25' => ['damage', 25, true],
            'damage 70' => ['damage', 70, true],
            'damage 71' => ['damage', 71, false],
            'cooldown 500' => ['cooldown_ms', 500, false],
            'cooldown 1000' => ['cooldown_ms', 1000, true],
            'cooldown 1250' => ['cooldown_ms', 1250, false],
            'cooldown 1500' => ['cooldown_ms', 1500, true],
            'cooldown 4000' => ['cooldown_ms', 4000, true],
            'cooldown 4500' => ['cooldown_ms', 4500, false],
        ];
    }

    #[DataProvider('gameFieldBoundaries')]
    public function test_game_field_boundaries(string $field, int $value, bool $valid): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson(self::URL, $this->payload([$field => $value]));

        if ($valid) {
            $response->assertCreated()->assertJsonPath('data.'.$field, $value);
        } else {
            $response->assertUnprocessable()->assertJsonValidationErrors($field);
        }
    }

    public function test_soft_skill_needs_no_game_fields_and_stores_them_as_null(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, ['name' => 'Public Speaking', 'category' => 'soft'])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'public-speaking')
            ->assertJsonPath('data.attack_name', null)
            ->assertJsonPath('data.damage', null)
            ->assertJsonPath('data.cooldown_ms', null)
            ->assertJsonPath('data.dps', null)
            ->assertJsonPath('data.dps_warning', null);

        // Game values sent for a soft skill are ignored, even out-of-range ones.
        $response = $this->postJson(self::URL, [
            'name' => 'Leadership',
            'category' => 'soft',
            'attack_name' => 'Rally',
            'damage' => 999,
            'cooldown_ms' => 1250,
        ])->assertCreated();

        $this->assertDatabaseHas('skills', [
            'id' => $response->json('data.id'),
            'attack_name' => null,
            'damage' => null,
            'cooldown_ms' => null,
        ]);
    }

    public function test_update_changes_fields_and_keeps_its_own_slug(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create(['name' => 'Laravel', 'slug' => 'laravel', 'sort_order' => 3]);

        $this->mock(RevalidationService::class)->shouldReceive('revalidateAll')->once();

        $this->putJson(self::URL.'/'.$skill->id, $this->payload([
            'name' => 'Laravel 13',
            'slug' => 'laravel',
            'damage' => 65,
            'cooldown_ms' => 3500,
            'is_visible' => false,
        ]))
            ->assertOk()
            ->assertJsonPath('data.id', $skill->id)
            ->assertJsonPath('data.name', 'Laravel 13')
            ->assertJsonPath('data.slug', 'laravel')
            ->assertJsonPath('data.damage', 65)
            ->assertJsonPath('data.is_visible', false)
            ->assertJsonPath('data.sort_order', 3)
            ->assertJsonPath('data.dps', 18.6);
    }

    public function test_update_slug_rules(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['slug' => 'php']);
        $skill = Skill::factory()->create(['name' => 'Laravel', 'slug' => 'laravel']);

        // Omitted slug: kept even when the name changes.
        $this->putJson(self::URL.'/'.$skill->id, $this->payload(['name' => 'Lumen']))
            ->assertOk()
            ->assertJsonPath('data.slug', 'laravel');

        // Empty slug: regenerated from the name (made unique, ignoring itself).
        $this->putJson(self::URL.'/'.$skill->id, $this->payload(['name' => 'PHP', 'slug' => '']))
            ->assertOk()
            ->assertJsonPath('data.slug', 'php-2');

        $this->putJson(self::URL.'/'.$skill->id, $this->payload(['name' => 'PHP', 'slug' => null]))
            ->assertOk()
            ->assertJsonPath('data.slug', 'php-2');

        // Explicit slug taken by another skill.
        $this->putJson(self::URL.'/'.$skill->id, $this->payload(['slug' => 'php']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slug');
    }

    public function test_update_to_soft_clears_game_fields_and_back_requires_them(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create();

        $this->putJson(self::URL.'/'.$skill->id, ['name' => 'Teamwork', 'category' => 'soft'])
            ->assertOk()
            ->assertJsonPath('data.category', 'soft')
            ->assertJsonPath('data.attack_name', null)
            ->assertJsonPath('data.damage', null)
            ->assertJsonPath('data.cooldown_ms', null);

        $this->putJson(self::URL.'/'.$skill->id, ['name' => 'Teamwork', 'category' => 'backend'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['attack_name', 'damage', 'cooldown_ms']);
    }

    public function test_update_unknown_skill_is_404(): void
    {
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/999999', $this->payload())->assertNotFound();
    }

    public function test_destroy_deletes_and_detaches_from_projects(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create();
        $other = Skill::factory()->create();
        $project = Project::factory()->create();
        $project->skills()->attach([$skill->id => ['sort_order' => 0], $other->id => ['sort_order' => 1]]);

        $this->mock(RevalidationService::class)->shouldReceive('revalidateAll')->once();

        $this->deleteJson(self::URL.'/'.$skill->id)
            ->assertOk()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseMissing('skills', ['id' => $skill->id]);
        $this->assertDatabaseMissing('project_skill', ['skill_id' => $skill->id]);
        $this->assertDatabaseHas('project_skill', ['project_id' => $project->id, 'skill_id' => $other->id]);
        $this->assertDatabaseHas('projects', ['id' => $project->id]);

        $this->deleteJson(self::URL.'/'.$skill->id)->assertNotFound();
    }

    public function test_reorder_updates_sort_order(): void
    {
        $this->actingAsAdmin();
        $a = Skill::factory()->create(['sort_order' => 0]);
        $b = Skill::factory()->create(['sort_order' => 1]);
        $c = Skill::factory()->create(['sort_order' => 2]);

        $this->mock(RevalidationService::class)->shouldReceive('revalidateAll')->once();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $a->id, 'sort_order' => 2],
            ['id' => $b->id, 'sort_order' => 0],
            ['id' => $c->id, 'sort_order' => 1],
        ]])
            ->assertOk()
            ->assertExactJson(['data' => ['ok' => true]]);

        $this->assertSame([$b->id, $c->id, $a->id], array_column($this->getJson(self::URL)->json('data'), 'id'));
        $this->assertDatabaseHas('skills', ['id' => $a->id, 'name' => $a->name, 'damage' => $a->damage]);
    }

    public function test_reorder_rejects_unknown_ids(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create(['sort_order' => 0]);

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $skill->id, 'sort_order' => 5],
            ['id' => 999999, 'sort_order' => 1],
        ]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        $this->assertDatabaseHas('skills', ['id' => $skill->id, 'sort_order' => 0]);
    }

    public function test_public_list_excludes_soft_and_hidden_skills(): void
    {
        $icon = Media::factory()->create();
        $later = Skill::factory()->create(['sort_order' => 2, 'name' => 'Laravel', 'slug' => 'laravel', 'icon_media_id' => $icon->id]);
        $tieB = Skill::factory()->create(['sort_order' => 1]);
        $tieA = Skill::factory()->create(['sort_order' => 1]);
        $first = Skill::factory()->create(['sort_order' => 0]);
        Skill::factory()->hidden()->create(['sort_order' => 0]);
        Skill::factory()->soft()->create(['sort_order' => 0]);

        $list = app(SkillService::class)->publicList();

        $this->assertSame([$first->id, $tieB->id, $tieA->id, $later->id], array_column($list, 'id'));
        $this->assertSame(self::PUBLIC_KEYS, array_keys($list[0]));
        $this->assertNull($list[0]['icon']);
        $this->assertSame($icon->id, $list[3]['icon']['id']);
        $this->assertStringEndsWith('/storage/'.$icon->path, $list[3]['icon']['url']);
        $this->assertSame('laravel', $list[3]['slug']);
        $this->assertSame(40, $list[3]['damage']);
        $this->assertSame(2000, $list[3]['cooldown_ms']);
    }

    public function test_soft_skill_names_are_visible_soft_skills_by_sort_order(): void
    {
        Skill::factory()->soft()->create(['name' => 'Teamwork', 'sort_order' => 2]);
        Skill::factory()->soft()->create(['name' => 'Public Speaking', 'sort_order' => 0]);
        Skill::factory()->soft()->create(['name' => 'Leadership', 'sort_order' => 1]);
        Skill::factory()->soft()->hidden()->create(['name' => 'Hidden', 'sort_order' => 0]);
        Skill::factory()->create(['name' => 'Laravel', 'sort_order' => 0]);

        $this->assertSame(
            ['Public Speaking', 'Leadership', 'Teamwork'],
            app(SkillService::class)->softSkillNames(),
        );
    }

    public function test_is_visible_can_be_toggled_alone(): void
    {
        $this->actingAsAdmin();
        $skill = Skill::factory()->create(['name' => 'Laravel', 'damage' => 70, 'is_visible' => true]);

        $this->putJson(self::URL.'/'.$skill->id, ['is_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.is_visible', false)
            ->assertJsonPath('data.name', 'Laravel')
            ->assertJsonPath('data.damage', 70);

        $soft = Skill::factory()->soft()->create();
        $this->putJson(self::URL.'/'.$soft->id, ['is_visible' => false])->assertOk()->assertJsonPath('data.is_visible', false);
    }

    public function test_partial_update_checks_game_fields_against_the_stored_row(): void
    {
        $this->actingAsAdmin();
        $soft = Skill::factory()->soft()->create();

        // soft → game category without the game fields: they are still null in the stored row.
        $this->putJson(self::URL.'/'.$soft->id, ['category' => 'backend'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['attack_name', 'damage', 'cooldown_ms']);
        $this->putJson(self::URL.'/'.$soft->id, ['category' => 'backend', 'attack_name' => 'Pep Talk', 'damage' => 30, 'cooldown_ms' => 1500])
            ->assertOk()
            ->assertJsonPath('data.damage', 30);

        // A game skill may change one game field alone, but not blank it.
        $this->putJson(self::URL.'/'.$soft->id, ['damage' => 40])->assertOk()->assertJsonPath('data.cooldown_ms', 1500);
        $this->putJson(self::URL.'/'.$soft->id, ['damage' => null])->assertUnprocessable()->assertJsonValidationErrors('damage');
        $this->putJson(self::URL.'/'.$soft->id, ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_icon_must_be_an_image(): void
    {
        $this->actingAsAdmin();
        $pdf = Media::factory()->pdf()->create();
        $image = Media::factory()->create();

        $this->postJson(self::URL, $this->payload(['icon_media_id' => $pdf->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('icon_media_id');
        $this->postJson(self::URL, $this->payload(['icon_media_id' => $image->id]))
            ->assertCreated()->assertJsonPath('data.icon_media_id', $image->id);
    }

    public function test_new_skills_never_get_a_sort_order_past_the_column_limit(): void
    {
        $this->actingAsAdmin();
        Skill::factory()->create(['sort_order' => 65535]);

        $this->postJson(self::URL, $this->payload(['name' => 'Last']))->assertCreated()->assertJsonPath('data.sort_order', 65535);
    }
}
