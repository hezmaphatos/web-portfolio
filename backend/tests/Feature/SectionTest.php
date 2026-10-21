<?php

namespace Tests\Feature;

use App\Models\Section;
use App\Services\RevalidationService;
use App\Services\SectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class SectionTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/sections';

    private const PUBLIC_KEYS = ['key', 'title', 'subtitle', 'body', 'hint', 'sort_order'];

    private const ADMIN_KEYS = ['id', ...self::PUBLIC_KEYS, 'is_visible', 'created_at', 'updated_at'];

    protected function setUp(): void
    {
        parent::setUp();

        Http::fake();
    }

    /** The 8 fixed chapters, in spec order. */
    private function seedSections(): void
    {
        foreach (Section::KEYS as $order => $key) {
            Section::factory()->create(['key' => $key, 'title' => strtoupper($key), 'sort_order' => $order]);
        }
    }

    public function test_endpoints_require_authentication(): void
    {
        $section = Section::factory()->create(['key' => 'hero']);

        $this->getJson(self::URL)->assertUnauthorized();
        $this->getJson(self::URL.'/'.$section->id)->assertUnauthorized();
        $this->putJson(self::URL.'/'.$section->id, ['title' => 'X'])->assertUnauthorized();
    }

    public function test_index_lists_every_section_by_sort_order(): void
    {
        $this->seedSections();
        Section::query()->where('key', 'boot')->update(['sort_order' => 20, 'is_visible' => false]);
        $this->actingAsAdmin();

        $response = $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonStructure(['data' => ['*' => self::ADMIN_KEYS]]);

        $this->assertSame(
            ['hero', 'about', 'journey', 'skills', 'projects', 'trophies', 'contact', 'boot'],
            array_column($response->json('data'), 'key'),
        );
        $response->assertJsonPath('data.7.is_visible', false);
    }

    public function test_show_returns_one_section_or_404(): void
    {
        $section = Section::factory()->create(['key' => 'about', 'title' => 'CHARACTER SELECT', 'hint' => 'Flip it.']);
        $this->actingAsAdmin();

        $this->getJson(self::URL.'/'.$section->id)
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.key', 'about')
            ->assertJsonPath('data.title', 'CHARACTER SELECT')
            ->assertJsonPath('data.hint', 'Flip it.');

        $this->getJson(self::URL.'/999')->assertNotFound()->assertExactJson(['message' => 'Not found.']);
    }

    public function test_update_changes_texts_and_visibility_but_never_the_key(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateHome')->once();
        $section = Section::factory()->create(['key' => 'hero', 'sort_order' => 1]);
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/'.$section->id, [
            'key' => 'hacked',
            'sort_order' => 99,
            'title' => 'PLAYER ONE',
            'subtitle' => 'Insert coin',
            'body' => 'Intro text.',
            'hint' => 'Grab the sticker and throw it.',
            'is_visible' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.key', 'hero')
            ->assertJsonPath('data.title', 'PLAYER ONE')
            ->assertJsonPath('data.subtitle', 'Insert coin')
            ->assertJsonPath('data.hint', 'Grab the sticker and throw it.')
            ->assertJsonPath('data.is_visible', false)
            ->assertJsonPath('data.sort_order', 1);

        $this->assertDatabaseHas('sections', ['id' => $section->id, 'key' => 'hero', 'sort_order' => 1, 'is_visible' => false]);
    }

    public function test_update_accepts_a_partial_body(): void
    {
        $section = Section::factory()->create(['key' => 'skills', 'title' => 'SKILL TREE']);
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/'.$section->id, ['is_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.title', 'SKILL TREE')
            ->assertJsonPath('data.is_visible', false);
    }

    public function test_update_rejects_invalid_input(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateHome');
        $section = Section::factory()->create(['key' => 'contact']);
        $this->actingAsAdmin();

        $this->putJson(self::URL.'/'.$section->id, ['title' => '', 'hint' => Str::repeat('a', 301), 'is_visible' => 'maybe'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'hint', 'is_visible']);

        $this->putJson(self::URL.'/999', ['title' => 'X'])->assertNotFound();
    }

    public function test_sections_cannot_be_created_or_deleted(): void
    {
        $section = Section::factory()->create(['key' => 'boot']);
        $this->actingAsAdmin();

        $this->postJson(self::URL, ['key' => 'extra', 'title' => 'X'])->assertMethodNotAllowed();
        $this->deleteJson(self::URL.'/'.$section->id)->assertMethodNotAllowed();

        $this->assertDatabaseCount('sections', 1);
    }

    public function test_public_list_returns_visible_sections_in_order(): void
    {
        $this->seedSections();
        Section::query()->where('key', 'trophies')->update(['is_visible' => false]);
        Section::query()->where('key', 'boot')->update(['sort_order' => 3]);

        $sections = $this->app->make(SectionService::class)->publicList();

        // boot and journey share sort_order 3: the lower id (boot) wins the tie.
        $this->assertSame(
            ['hero', 'about', 'boot', 'journey', 'skills', 'projects', 'contact'],
            array_column($sections, 'key'),
        );
        $this->assertSame(self::PUBLIC_KEYS, array_keys($sections[0]));
        $this->assertSame(1, $sections[0]['sort_order']);
    }
}
