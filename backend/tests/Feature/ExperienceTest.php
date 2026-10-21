<?php

namespace Tests\Feature;

use App\Models\Experience;
use App\Models\Media;
use App\Services\ExperienceService;
use App\Services\RevalidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExperienceTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/experiences';

    private const PUBLIC_KEYS = [
        'id', 'type', 'title', 'organization', 'location', 'subtitle', 'start_date', 'end_date', 'is_current',
        'description', 'bullets', 'metrics', 'logo', 'sort_order',
    ];

    private const ADMIN_KEYS = [...self::PUBLIC_KEYS, 'is_visible', 'logo_media_id', 'created_at', 'updated_at'];

    protected function setUp(): void
    {
        parent::setUp();

        Http::fake();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'type' => 'freelance',
            'title' => 'Sales & Marketing',
            'organization' => 'Universitas Multimedia Nusantara',
            'location' => 'Tangerang',
            'subtitle' => null,
            'start_date' => '2025-05-01',
            'end_date' => null,
            'description' => 'Enrollment support.',
            'bullets' => ['Followed up prospective students.', 'Coordinated campus tours.'],
            'metrics' => [
                ['label' => 'full enrollments', 'value' => 50, 'prefix' => '', 'suffix' => '+'],
                ['label' => 'Shorts views', 'value' => '1.3', 'suffix' => 'K'],
            ],
            'is_visible' => true,
        ], $overrides);
    }

    public function test_endpoints_require_authentication(): void
    {
        $experience = Experience::factory()->create();

        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::URL, $this->payload())->assertUnauthorized();
        $this->getJson(self::URL.'/'.$experience->id)->assertUnauthorized();
        $this->putJson(self::URL.'/'.$experience->id, $this->payload())->assertUnauthorized();
        $this->deleteJson(self::URL.'/'.$experience->id)->assertUnauthorized();
        $this->postJson(self::URL.'/reorder', ['items' => [['id' => $experience->id, 'sort_order' => 5]]])->assertUnauthorized();

        $this->assertDatabaseHas('experiences', ['id' => $experience->id, 'sort_order' => 0]);
    }

    public function test_index_lists_every_experience_by_sort_order_then_id(): void
    {
        $logo = Media::factory()->create();
        $c = Experience::factory()->create(['sort_order' => 1, 'title' => 'C']);
        $a = Experience::factory()->hidden()->create(['sort_order' => 0, 'title' => 'A', 'logo_media_id' => $logo->id]);
        $b = Experience::factory()->create(['sort_order' => 1, 'title' => 'B', 'end_date' => '2025-06-30']);
        $this->actingAsAdmin();

        $response = $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => ['*' => self::ADMIN_KEYS]]);

        $this->assertSame([$a->id, $c->id, $b->id], array_column($response->json('data'), 'id'));
        $response->assertJsonPath('data.0.is_visible', false)
            ->assertJsonPath('data.0.logo.id', $logo->id)
            ->assertJsonPath('data.0.logo_media_id', $logo->id)
            ->assertJsonPath('data.1.is_current', true)
            ->assertJsonPath('data.2.is_current', false)
            ->assertJsonPath('data.2.end_date', '2025-06-30');
    }

    public function test_store_creates_an_experience_at_the_end(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        Experience::factory()->create(['sort_order' => 4]);
        $logo = Media::factory()->create();
        $this->actingAsAdmin();

        $response = $this->postJson(self::URL, $this->payload(['logo_media_id' => $logo->id]));

        $response->assertCreated()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.type', 'freelance')
            ->assertJsonPath('data.start_date', '2025-05-01')
            ->assertJsonPath('data.end_date', null)
            ->assertJsonPath('data.is_current', true)
            ->assertJsonPath('data.bullets', ['Followed up prospective students.', 'Coordinated campus tours.'])
            ->assertJsonPath('data.metrics', [
                ['label' => 'full enrollments', 'value' => 50, 'prefix' => '', 'suffix' => '+'],
                ['label' => 'Shorts views', 'value' => 1.3, 'prefix' => '', 'suffix' => 'K'],
            ])
            ->assertJsonPath('data.logo.id', $logo->id)
            ->assertJsonPath('data.sort_order', 5);

        $this->assertDatabaseHas('experiences', ['id' => $response->json('data.id'), 'title' => 'Sales & Marketing']);
    }

    public function test_store_starts_at_zero_and_keeps_an_explicit_sort_order(): void
    {
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload(['sort_order' => null]))->assertCreated()->assertJsonPath('data.sort_order', 0);
        $this->postJson(self::URL, $this->payload(['sort_order' => 9]))->assertCreated()->assertJsonPath('data.sort_order', 9);
        $this->postJson(self::URL, $this->payload(['bullets' => null, 'metrics' => null]))
            ->assertCreated()
            ->assertJsonPath('data.sort_order', 10)
            ->assertJsonPath('data.bullets', [])
            ->assertJsonPath('data.metrics', []);
    }

    public function test_store_rejects_invalid_input(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateHome');
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload([
            'type' => 'job',
            'title' => '',
            'start_date' => '2025-05-01',
            'end_date' => '2025-04-30',
            'bullets' => [Str::repeat('a', 501)],
            'metrics' => [['label' => 'users', 'value' => 'lots']],
            'logo_media_id' => 999,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type', 'title', 'end_date', 'bullets.0', 'metrics.0.value', 'logo_media_id']);

        $this->postJson(self::URL, $this->payload(['start_date' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_date']);

        $this->postJson(self::URL, $this->payload(['start_date' => '01/05/2025']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_date']);

        $this->assertDatabaseCount('experiences', 0);
    }

    public function test_show_returns_one_experience_or_404(): void
    {
        $experience = Experience::factory()->create(['title' => 'IT Member', 'bullets' => null, 'metrics' => null]);
        $this->actingAsAdmin();

        $this->getJson(self::URL.'/'.$experience->id)
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.title', 'IT Member')
            ->assertJsonPath('data.bullets', [])
            ->assertJsonPath('data.metrics', []);

        $this->getJson(self::URL.'/999')->assertNotFound();
    }

    public function test_update_changes_fields(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $experience = Experience::factory()->create(['sort_order' => 3]);
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/'.$experience->id, $this->payload([
            'type' => 'internship',
            'end_date' => '2026-07-31',
            'metrics' => [],
            'sort_order' => null,
        ]))
            ->assertOk()
            ->assertJsonPath('data.type', 'internship')
            ->assertJsonPath('data.end_date', '2026-07-31')
            ->assertJsonPath('data.is_current', false)
            ->assertJsonPath('data.metrics', [])
            ->assertJsonPath('data.sort_order', 3);
    }

    public function test_update_accepts_a_partial_body_and_checks_dates_against_the_stored_ones(): void
    {
        $experience = Experience::factory()->create(['title' => 'Keep me', 'start_date' => '2025-01-01']);
        $this->actingAsAdmin();

        $this->patchJson(self::URL.'/'.$experience->id, ['is_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.title', 'Keep me')
            ->assertJsonPath('data.is_visible', false);

        $this->putJson(self::URL.'/'.$experience->id, ['end_date' => '2024-12-31'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date']);

        $this->putJson(self::URL.'/'.$experience->id, ['title' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);

        $this->putJson(self::URL.'/'.$experience->id, ['end_date' => '2025-01-01'])
            ->assertOk()
            ->assertJsonPath('data.end_date', '2025-01-01');

        $this->putJson(self::URL.'/999', ['is_visible' => true])->assertNotFound();
    }

    public function test_destroy_deletes_the_experience(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $experience = Experience::factory()->create();
        $this->actingAsAdmin();

        $this->deleteJson(self::URL.'/'.$experience->id)->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseMissing('experiences', ['id' => $experience->id]);
        $this->deleteJson(self::URL.'/'.$experience->id)->assertNotFound();
    }

    public function test_reorder_persists_the_new_order(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $a = Experience::factory()->create(['sort_order' => 0]);
        $b = Experience::factory()->create(['sort_order' => 1]);
        $c = Experience::factory()->create(['sort_order' => 2]);
        $this->actingAsAdmin();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $a->id, 'sort_order' => 2],
            ['id' => $b->id, 'sort_order' => 0],
            ['id' => $c->id, 'sort_order' => 1],
        ]])->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertSame([$b->id, $c->id, $a->id], array_column($this->getJson(self::URL)->json('data'), 'id'));
    }

    public function test_reorder_rejects_unknown_ids(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateHome');
        $a = Experience::factory()->create(['sort_order' => 0]);
        $this->actingAsAdmin();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $a->id, 'sort_order' => 1],
            ['id' => 999, 'sort_order' => 0],
        ]])->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->postJson(self::URL.'/reorder', ['items' => []])->assertUnprocessable();

        $this->assertDatabaseHas('experiences', ['id' => $a->id, 'sort_order' => 0]);
    }

    public function test_public_list_returns_visible_experiences_in_order_with_normalised_lists(): void
    {
        $logo = Media::factory()->create();
        $second = Experience::factory()->create(['sort_order' => 1, 'end_date' => '2023-08-31', 'metrics' => null, 'bullets' => null]);
        Experience::factory()->hidden()->create(['sort_order' => 0]);
        $first = Experience::factory()->create([
            'sort_order' => 0,
            'logo_media_id' => $logo->id,
            'metrics' => [
                ['label' => 'events', 'value' => 60, 'prefix' => '~'],
                ['label' => 'views', 'value' => '1.3', 'suffix' => 'K'],
                ['label' => 'students', 'value' => 1000.0],
            ],
        ]);

        $list = $this->app->make(ExperienceService::class)->publicList();

        $this->assertSame([$first->id, $second->id], array_column($list, 'id'));
        $this->assertSame(self::PUBLIC_KEYS, array_keys($list[0]));
        $this->assertSame([
            ['label' => 'events', 'value' => 60, 'prefix' => '~', 'suffix' => ''],
            ['label' => 'views', 'value' => 1.3, 'prefix' => '', 'suffix' => 'K'],
            ['label' => 'students', 'value' => 1000, 'prefix' => '', 'suffix' => ''],
        ], $list[0]['metrics']);
        $this->assertSame($logo->id, $list[0]['logo']['id']);
        $this->assertTrue($list[0]['is_current']);
        $this->assertSame('2025-01-01', $list[0]['start_date']);
        $this->assertFalse($list[1]['is_current']);
        $this->assertSame('2023-08-31', $list[1]['end_date']);
        $this->assertSame([], $list[1]['bullets']);
        $this->assertSame([], $list[1]['metrics']);
        $this->assertNull($list[1]['logo']);
    }
}
