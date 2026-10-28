<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\SiteSetting;
use App\Services\RevalidationService;
use App\Services\SiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/site';

    private const PUBLIC_KEYS = [
        'full_name', 'nickname', 'headline', 'roles', 'tagline', 'short_bio', 'long_bio', 'location',
        'email', 'phone', 'socials', 'stats', 'avatar', 'portrait', 'cv', 'seo_title', 'seo_description',
        'og_image', 'sound_default', 'tech_visible_percent',
    ];

    private const ADMIN_KEYS = [
        'id', ...self::PUBLIC_KEYS, 'show_phone', 'avatar_media_id', 'portrait_media_id', 'cv_media_id',
        'og_media_id', 'created_at', 'updated_at',
    ];

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
            'full_name' => 'Yehezkiel Natanael',
            'nickname' => 'Hezki',
            'headline' => 'Backend-focused developer',
            'roles' => ['Backend Developer', 'Laravel Engineer'],
            'tagline' => 'Building database-driven systems.',
            'short_bio' => 'Short bio.',
            'long_bio' => "## Hi\n\nLong bio.",
            'location' => 'Tangerang Selatan, Indonesia',
            'email' => 'hello@example.com',
            'phone' => '+62 812 0000 0000',
            'show_phone' => false,
            'socials' => [['label' => 'GitHub', 'url' => 'https://github.com/hezmaphatos', 'icon' => 'github']],
            'stats' => [
                ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
                ['label' => 'Projects', 'value' => null, 'auto' => 'projects'],
            ],
            'seo_title' => 'Hezki — Player One',
            'seo_description' => 'Portfolio.',
            'sound_default' => true,
            'tech_visible_percent' => 60,
        ], $overrides);
    }

    public function test_endpoints_require_authentication(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->putJson(self::URL, $this->payload())->assertUnauthorized();

        $this->assertDatabaseCount('site_settings', 0);
    }

    public function test_show_creates_the_row_with_defaults_when_missing(): void
    {
        $this->actingAsAdmin();

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.id', SiteSetting::ID)
            ->assertJsonPath('data.full_name', 'Your Name')
            ->assertJsonPath('data.nickname', 'Player')
            ->assertJsonPath('data.roles', [])
            ->assertJsonPath('data.socials', [])
            ->assertJsonPath('data.stats', [])
            ->assertJsonPath('data.avatar', null)
            ->assertJsonPath('data.show_phone', false)
            ->assertJsonPath('data.tech_visible_percent', 50);

        $this->assertDatabaseCount('site_settings', 1);
        $this->assertDatabaseHas('site_settings', ['id' => SiteSetting::ID, 'full_name' => 'Your Name']);
    }

    public function test_show_returns_every_column_with_media_and_normalised_arrays(): void
    {
        $avatar = Media::factory()->create();
        $cv = Media::factory()->pdf()->create();
        SiteSetting::factory()->create([
            'roles' => null,
            'socials' => null,
            'stats' => [['label' => 'GPA', 'value' => 3.91, 'suffix' => '/4.00']],
            'avatar_media_id' => $avatar->id,
            'cv_media_id' => $cv->id,
            'show_phone' => false,
        ]);
        $this->actingAsAdmin();

        $this->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('data.roles', [])
            ->assertJsonPath('data.socials', [])
            ->assertJsonPath('data.stats', [
                ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
            ])
            // The admin always sees the phone; only the public payload hides it.
            ->assertJsonPath('data.phone', '+62 800 0000 0000')
            ->assertJsonPath('data.avatar_media_id', $avatar->id)
            ->assertJsonPath('data.avatar.id', $avatar->id)
            ->assertJsonPath('data.cv.mime', 'application/pdf')
            ->assertJsonPath('data.cv.thumb_url', null)
            ->assertJsonPath('data.portrait', null)
            ->assertJsonPath('data.og_image', null);
    }

    public function test_update_persists_and_returns_the_show_shape(): void
    {
        $this->mock(RevalidationService::class)->shouldReceive('revalidateAll')->once();
        SiteSetting::factory()->create();
        $avatar = Media::factory()->create();
        $og = Media::factory()->create();
        $this->actingAsAdmin();

        $response = $this->putJson(self::URL, $this->payload([
            'avatar_media_id' => $avatar->id,
            'og_media_id' => $og->id,
        ]));

        $response->assertOk()
            ->assertJsonStructure(['data' => self::ADMIN_KEYS])
            ->assertJsonPath('data.nickname', 'Hezki')
            ->assertJsonPath('data.roles', ['Backend Developer', 'Laravel Engineer'])
            ->assertJsonPath('data.socials.0', ['label' => 'GitHub', 'url' => 'https://github.com/hezmaphatos', 'icon' => 'github'])
            ->assertJsonPath('data.stats.1', ['label' => 'Projects', 'value' => '', 'prefix' => '', 'suffix' => '', 'auto' => 'projects'])
            ->assertJsonPath('data.avatar.id', $avatar->id)
            ->assertJsonPath('data.og_image.id', $og->id)
            ->assertJsonPath('data.sound_default', true)
            ->assertJsonPath('data.tech_visible_percent', 60);

        $site = SiteSetting::query()->findOrFail(SiteSetting::ID);
        $this->assertSame('Hezki', $site->nickname);
        $this->assertSame(60, $site->tech_visible_percent);
        $this->assertSame($og->id, (int) $site->og_media_id);
        // Stored normalised.
        $this->assertSame(['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null], $site->stats[0]);
    }

    public function test_update_creates_the_row_when_missing_and_accepts_numeric_stat_values(): void
    {
        $this->actingAsAdmin();

        $this->putJson(self::URL, $this->payload([
            'stats' => [['label' => 'Semester', 'value' => 7]],
        ]))
            ->assertOk()
            ->assertJsonPath('data.id', SiteSetting::ID)
            ->assertJsonPath('data.stats.0.value', '7');

        $this->assertDatabaseCount('site_settings', 1);
    }

    public function test_update_rejects_invalid_input(): void
    {
        $this->mock(RevalidationService::class)->shouldNotReceive('revalidateAll');
        SiteSetting::factory()->create();
        $this->actingAsAdmin();

        $this->putJson(self::URL, $this->payload([
            'full_name' => '',
            'tech_visible_percent' => 101,
            'avatar_media_id' => 999,
            'socials' => [['label' => 'GitHub', 'url' => 'not a url']],
            'stats' => [['label' => 'Skills', 'value' => '9', 'auto' => 'skills']],
            'roles' => ['Developer', ['nested']],
            'email' => 'nope',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'full_name', 'tech_visible_percent', 'avatar_media_id', 'socials.0.url', 'stats.0.auto',
                'roles.1', 'email',
            ]);

        $this->assertSame('Yehezkiel Natanael', SiteSetting::query()->findOrFail(SiteSetting::ID)->full_name);
    }

    public function test_update_rejects_a_negative_tech_visible_percent(): void
    {
        SiteSetting::factory()->create();
        $this->actingAsAdmin();

        $this->putJson(self::URL, $this->payload(['tech_visible_percent' => -1]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tech_visible_percent']);
    }

    public function test_public_site_hides_the_phone_unless_show_phone_and_keeps_stats_as_stored(): void
    {
        $portrait = Media::factory()->create();
        SiteSetting::factory()->create([
            'show_phone' => false,
            'portrait_media_id' => $portrait->id,
            'socials' => [['label' => 'GitHub', 'url' => 'https://github.com/x']],
            'stats' => [
                ['label' => 'GPA', 'value' => '3.91', 'suffix' => '/4.00'],
                ['label' => 'Projects', 'value' => '', 'auto' => 'projects'],
            ],
        ]);
        $service = $this->app->make(SiteService::class);

        $site = $service->publicSite();

        $this->assertSame(self::PUBLIC_KEYS, array_keys($site));
        $this->assertArrayNotHasKey('soft_skills', $site);
        $this->assertNull($site['phone']);
        $this->assertSame([['label' => 'GitHub', 'url' => 'https://github.com/x', 'icon' => null]], $site['socials']);
        $this->assertSame([
            ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
            ['label' => 'Projects', 'value' => '', 'prefix' => '', 'suffix' => '', 'auto' => 'projects'],
        ], $site['stats']);
        $this->assertSame($portrait->id, $site['portrait']['id']);
        $this->assertNull($site['avatar']);
        $this->assertSame(50, $site['tech_visible_percent']);
        $this->assertFalse($site['sound_default']);

        SiteSetting::query()->whereKey(SiteSetting::ID)->update(['show_phone' => true]);

        $this->assertSame('+62 800 0000 0000', $service->publicSite()['phone']);
    }
}
