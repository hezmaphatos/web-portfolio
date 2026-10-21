<?php

namespace Tests\Feature;

use App\Models\Award;
use App\Models\Media;
use App\Services\AwardService;
use App\Services\RevalidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AwardTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/awards';

    private const PUBLIC_KEYS = [
        'id', 'title', 'event', 'issuer', 'year', 'placement', 'category', 'description', 'image', 'url', 'sort_order',
    ];

    private const ADMIN_KEYS = [...self::PUBLIC_KEYS, 'is_visible', 'media_id', 'created_at', 'updated_at'];

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
            'title' => 'Gold Medal — National Level, English',
            'event' => 'Indonesian Student Olympiad (OPI)',
            'issuer' => 'Senior High School',
            'year' => 2022,
            'placement' => 'gold',
            'category' => 'Olympiad',
            'description' => null,
            'url' => 'https://example.com/certificate',
            'is_visible' => true,
        ], $overrides);
    }

    public function test_endpoints_require_authentication(): void
    {
        $award = Award::factory()->create();

        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::URL, $this->payload())->assertUnauthorized();
        $this->getJson(self::URL.'/'.$award->id)->assertUnauthorized();
        $this->putJson(self::URL.'/'.$award->id, $this->payload())->assertUnauthorized();
        $this->deleteJson(self::URL.'/'.$award->id)->assertUnauthorized();
        $this->postJson(self::URL.'/reorder', ['items' => [['id' => $award->id, 'sort_order' => 5]]])->assertUnauthorized();

        $this->assertDatabaseHas('awards', ['id' => $award->id, 'sort_order' => 0]);
    }

    public function test_index_lists_every_award_by_sort_order_then_id(): void
    {
        $image = Media::factory()->create();
        $b = Award::factory()->create(['sort_order' => 1]);
        $a = Award::factory()->hidden()->create(['sort_order' => 0, 'media_id' => $image->id]);
        $c = Award::factory()->create(['sort_order' => 1, 'year' => null]);
        $this->actingAsAdmin();

        $response = $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => ['*' => self::ADMIN_KEYS]]);

        $this->assertSame([$a->id, $b->id, $c->id], array_column($response->json('data'), 'id'));
        $response->assertJsonPath('data.0.is_visible', false)
            ->assertJsonPath('data.0.image.id', $image->id)
            ->assertJsonPath('data.0.media_id', $image->id)
            ->assertJsonPath('data.1.image', null)
            ->assertJsonPath('data.2.year', null);
    }

    public function test_store_creates_an_award_at_the_end(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        Award::factory()->create(['sort_order' => 2]);
        $image = Media::factory()->create();
        $this->actingAsAdmin();

        $response = $this->postJson(self::URL, $this->payload(['media_id' => $image->id]));

        $response->assertCreated()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.title', 'Gold Medal — National Level, English')
            ->assertJsonPath('data.year', 2022)
            ->assertJsonPath('data.placement', 'gold')
            ->assertJsonPath('data.image.id', $image->id)
            ->assertJsonPath('data.media_id', $image->id)
            ->assertJsonPath('data.is_visible', true)
            ->assertJsonPath('data.sort_order', 3);

        $this->assertDatabaseHas('awards', ['id' => $response->json('data.id'), 'event' => 'Indonesian Student Olympiad (OPI)']);
    }

    public function test_store_defaults_placement_and_sort_order(): void
    {
        $this->actingAsAdmin();

        $payload = $this->payload();
        unset($payload['placement']);

        $this->postJson(self::URL, $payload)
            ->assertCreated()
            ->assertJsonPath('data.placement', 'participant')
            ->assertJsonPath('data.sort_order', 0);
    }

    public function test_store_rejects_invalid_input(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateHome');
        $this->actingAsAdmin();

        $this->postJson(self::URL, $this->payload([
            'title' => '',
            'event' => null,
            'year' => 1989,
            'placement' => 'platinum',
            'media_id' => 999,
            'url' => 'not a url',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'event', 'year', 'placement', 'media_id', 'url']);

        $this->assertDatabaseCount('awards', 0);
    }

    public function test_show_returns_one_award_or_404(): void
    {
        $award = Award::factory()->create(['title' => 'Participant', 'event' => 'ICP Hackathon 10']);
        $this->actingAsAdmin();

        $this->getJson(self::URL.'/'.$award->id)
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.event', 'ICP Hackathon 10');

        $this->getJson(self::URL.'/999')->assertNotFound();
    }

    public function test_update_changes_fields_and_accepts_a_partial_body(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->twice();
        $award = Award::factory()->create(['sort_order' => 4]);
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/'.$award->id, $this->payload(['placement' => 'silver', 'sort_order' => null]))
            ->assertOk()
            ->assertJsonPath('data.placement', 'silver')
            ->assertJsonPath('data.event', 'Indonesian Student Olympiad (OPI)')
            ->assertJsonPath('data.sort_order', 4);

        $this->patchJson(self::URL.'/'.$award->id, ['is_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.placement', 'silver')
            ->assertJsonPath('data.is_visible', false);

        $this->putJson(self::URL.'/'.$award->id, ['event' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['event']);
    }

    public function test_destroy_deletes_the_award(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $award = Award::factory()->create();
        $this->actingAsAdmin();

        $this->deleteJson(self::URL.'/'.$award->id)->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseMissing('awards', ['id' => $award->id]);
        $this->deleteJson(self::URL.'/'.$award->id)->assertNotFound();
    }

    public function test_reorder_persists_the_new_order(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $a = Award::factory()->create(['sort_order' => 0]);
        $b = Award::factory()->create(['sort_order' => 1]);
        $this->actingAsAdmin();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $a->id, 'sort_order' => 1],
            ['id' => $b->id, 'sort_order' => 0],
        ]])->assertOk()->assertExactJson(['data' => ['ok' => true]]);

        $this->assertDatabaseHas('awards', ['id' => $a->id, 'sort_order' => 1]);
        $this->assertDatabaseHas('awards', ['id' => $b->id, 'sort_order' => 0]);
    }

    public function test_reorder_rejects_unknown_ids(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateHome');
        $a = Award::factory()->create(['sort_order' => 0]);
        $this->actingAsAdmin();

        $this->postJson(self::URL.'/reorder', ['items' => [
            ['id' => $a->id, 'sort_order' => 1],
            ['id' => 999, 'sort_order' => 0],
        ]])->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->assertDatabaseHas('awards', ['id' => $a->id, 'sort_order' => 0]);
    }

    public function test_public_list_returns_visible_awards_in_order(): void
    {
        $image = Media::factory()->create();
        $second = Award::factory()->create(['sort_order' => 1]);
        Award::factory()->hidden()->create(['sort_order' => 0]);
        $first = Award::factory()->create(['sort_order' => 0, 'media_id' => $image->id, 'placement' => 'gold']);

        $list = $this->app->make(AwardService::class)->publicList();

        $this->assertSame([$first->id, $second->id], array_column($list, 'id'));
        $this->assertSame(self::PUBLIC_KEYS, array_keys($list[0]));
        $this->assertSame($image->id, $list[0]['image']['id']);
        $this->assertSame('gold', $list[0]['placement']);
        $this->assertSame(2025, $list[1]['year']);
        $this->assertNull($list[1]['image']);
    }
}
