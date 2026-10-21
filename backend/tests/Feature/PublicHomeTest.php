<?php

namespace Tests\Feature;

use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use App\Models\Project;
use App\Models\Section;
use App\Models\SiteSetting;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicHomeTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/public/home';

    private const MEDIA_KEYS = ['id', 'url', 'thumb_url', 'mime', 'width', 'height', 'alt', 'blur_data_url', 'dominant_color'];

    /** docs/API.md → `site`, in contract order (soft_skills right after stats). */
    private const SITE_KEYS = [
        'full_name', 'nickname', 'headline', 'roles', 'tagline', 'short_bio', 'long_bio', 'location', 'email',
        'phone', 'socials', 'stats', 'soft_skills', 'avatar', 'portrait', 'cv', 'seo_title', 'seo_description',
        'og_image', 'sound_default', 'tech_visible_percent',
    ];

    private const SECTION_KEYS = ['key', 'title', 'subtitle', 'body', 'hint', 'sort_order'];

    private const EXPERIENCE_KEYS = [
        'id', 'type', 'title', 'organization', 'location', 'subtitle', 'start_date', 'end_date', 'is_current',
        'description', 'bullets', 'metrics', 'logo', 'sort_order',
    ];

    private const SKILL_KEYS = [
        'id', 'name', 'slug', 'category', 'level', 'status', 'icon_key', 'icon', 'description',
        'attack_name', 'damage', 'cooldown_ms', 'sort_order',
    ];

    private const AWARD_KEYS = [
        'id', 'title', 'event', 'issuer', 'year', 'placement', 'category', 'description', 'image', 'url', 'sort_order',
    ];

    private const SUMMARY_KEYS = [
        'id', 'slug', 'title', 'tagline', 'summary', 'category', 'kind', 'progress', 'role', 'team_size',
        'year_start', 'year_end', 'accent_color', 'is_featured', 'sort_order',
        'cover', 'hover_image', 'hover_video', 'peek', 'gallery_count',
        'skills' => ['*' => ['id', 'name', 'slug', 'category', 'level', 'icon_key']],
        'boss' => ['enabled', 'tier', 'name', 'hp', 'sprite', 'intro', 'defeat_text'],
        'live_url', 'repo_url', 'allow_iframe_preview', 'has_video',
    ];

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function site(array $attributes = []): SiteSetting
    {
        return SiteSetting::factory()->create(array_merge([
            'id' => SiteSetting::ID,
            'socials' => [['label' => 'GitHub', 'url' => 'https://github.com/example', 'icon' => 'github']],
            'stats' => [
                ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
                ['label' => 'Projects', 'value' => '0', 'prefix' => '', 'suffix' => '+', 'auto' => 'projects'],
            ],
        ], $attributes));
    }

    /** A published project with a cover, 2 visible skills and 2 gallery images. */
    private function project(int $sortOrder = 0): Project
    {
        $project = Project::factory()->create([
            'sort_order' => $sortOrder,
            'cover_media_id' => Media::factory()->create()->id,
        ]);
        $project->skills()->attach(Skill::factory()->count(2)->create()->modelKeys());
        $project->gallery()->attach(Media::factory()->count(2)->create()->modelKeys());

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

    public function test_home_returns_the_documented_structure(): void
    {
        $this->site([
            'avatar_media_id' => Media::factory()->create()->id,
            'cv_media_id' => Media::factory()->pdf()->create()->id,
        ]);
        Section::factory()->create(['key' => 'boot', 'hint' => 'Press START']);
        Experience::factory()->create([
            'logo_media_id' => Media::factory()->create()->id,
            'metrics' => [['label' => 'full enrollments', 'value' => 50, 'prefix' => '', 'suffix' => '+']],
        ]);
        $skill = Skill::factory()->create(['icon_media_id' => Media::factory()->create()->id]);
        Skill::factory()->soft()->create(['name' => 'Public Speaking']);
        $project = Project::factory()->create(['cover_media_id' => Media::factory()->create()->id]);
        $project->skills()->attach($skill->id);
        $project->gallery()->attach(Media::factory()->count(2)->create()->modelKeys());
        Award::factory()->create(['media_id' => Media::factory()->create()->id]);

        $response = $this->getJson(self::URL)->assertOk()->assertJsonStructure([
            'data' => [
                'site' => [
                    'full_name', 'nickname', 'headline', 'roles', 'tagline', 'short_bio', 'long_bio', 'location',
                    'email', 'phone',
                    'socials' => ['*' => ['label', 'url', 'icon']],
                    'stats' => ['*' => ['label', 'value', 'prefix', 'suffix', 'auto']],
                    'soft_skills',
                    'avatar' => self::MEDIA_KEYS,
                    'portrait',
                    'cv' => self::MEDIA_KEYS,
                    'seo_title', 'seo_description', 'og_image', 'sound_default', 'tech_visible_percent',
                ],
                'sections' => ['*' => self::SECTION_KEYS],
                'experiences' => ['*' => array_merge(self::EXPERIENCE_KEYS, [
                    'metrics' => ['*' => ['label', 'value', 'prefix', 'suffix']],
                    'logo' => self::MEDIA_KEYS,
                ])],
                'skills' => ['*' => array_merge(self::SKILL_KEYS, ['icon' => self::MEDIA_KEYS])],
                'projects' => ['*' => array_merge(self::SUMMARY_KEYS, [
                    'cover' => self::MEDIA_KEYS,
                    'peek' => ['*' => self::MEDIA_KEYS],
                ])],
                'awards' => ['*' => array_merge(self::AWARD_KEYS, ['image' => self::MEDIA_KEYS])],
            ],
        ]);

        $data = $response->json('data');
        $this->assertSame(['site', 'sections', 'experiences', 'skills', 'projects', 'awards'], array_keys($data));

        // Exact key sets: no admin-only column leaks into the public payload.
        $this->assertSame(self::SITE_KEYS, array_keys($data['site']));
        $this->assertSame(self::SECTION_KEYS, array_keys($data['sections'][0]));
        $this->assertSame(self::EXPERIENCE_KEYS, array_keys($data['experiences'][0]));
        $this->assertSame(self::SKILL_KEYS, array_keys($data['skills'][0]));
        $this->assertSame(self::AWARD_KEYS, array_keys($data['awards'][0]));

        $this->assertNull($data['site']['cv']['thumb_url']);
        $this->assertSame('application/pdf', $data['site']['cv']['mime']);
        $this->assertSame(['Backend Developer'], $data['site']['roles']);
        $this->assertSame('Press START', $data['sections'][0]['hint']);
        $this->assertSame(50, $data['experiences'][0]['metrics'][0]['value']);
        $this->assertTrue($data['experiences'][0]['is_current']);
        $this->assertSame(40, $data['skills'][0]['damage']);
        $this->assertSame(2000, $data['skills'][0]['cooldown_ms']);
        $this->assertSame(2, $data['projects'][0]['gallery_count']);
        $this->assertSame([$skill->id], array_column($data['projects'][0]['skills'], 'id'));
        $this->assertSame(['Public Speaking'], $data['site']['soft_skills']);
        $this->assertSame(50, $data['site']['tech_visible_percent']);
        $this->assertFalse($data['site']['sound_default']);
    }

    public function test_hidden_and_draft_content_is_excluded(): void
    {
        $this->site();
        Section::factory()->create(['key' => 'boot']);
        Section::factory()->create(['key' => 'about', 'is_visible' => false]);
        $visibleExperience = Experience::factory()->create();
        Experience::factory()->hidden()->create();
        $visibleSkill = Skill::factory()->create();
        Skill::factory()->hidden()->create();
        $published = Project::factory()->create();
        Project::factory()->draft()->create();
        $visibleAward = Award::factory()->create();
        Award::factory()->hidden()->create();

        $data = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame(['boot'], array_column($data['sections'], 'key'));
        $this->assertSame([$visibleExperience->id], array_column($data['experiences'], 'id'));
        $this->assertSame([$visibleSkill->id], array_column($data['skills'], 'id'));
        $this->assertSame([$published->id], array_column($data['projects'], 'id'));
        $this->assertSame([$visibleAward->id], array_column($data['awards'], 'id'));
    }

    public function test_soft_skills_are_only_listed_as_names_in_site(): void
    {
        $this->site();
        $game = Skill::factory()->create(['sort_order' => 0]);
        Skill::factory()->soft()->create(['name' => 'Teamwork', 'sort_order' => 3]);
        Skill::factory()->soft()->create(['name' => 'Public Speaking', 'sort_order' => 1]);
        Skill::factory()->soft()->hidden()->create(['name' => 'Hidden Talent', 'sort_order' => 2]);

        $data = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame(['Public Speaking', 'Teamwork'], $data['site']['soft_skills']);
        $this->assertSame([$game->id], array_column($data['skills'], 'id'));
        $this->assertNotContains('soft', array_column($data['skills'], 'category'));
    }

    public function test_auto_stat_shows_the_published_project_count(): void
    {
        $this->site();
        Project::factory()->count(3)->create();
        Project::factory()->draft()->create();

        $stats = $this->getJson(self::URL)->assertOk()->json('data.site.stats');

        $this->assertSame([
            ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
            ['label' => 'Projects', 'value' => '3', 'prefix' => '', 'suffix' => '+', 'auto' => 'projects'],
        ], $stats);
    }

    public function test_phone_is_hidden_unless_show_phone(): void
    {
        $site = $this->site(['phone' => '+62 812 3456 7890', 'show_phone' => false]);

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.site.phone', null);

        $site->update(['show_phone' => true]);

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.site.phone', '+62 812 3456 7890');
    }

    public function test_every_list_is_ordered_by_sort_order_then_id(): void
    {
        $this->site();
        Section::factory()->create(['key' => 'hero', 'sort_order' => 1]);
        Section::factory()->create(['key' => 'boot', 'sort_order' => 0]);
        Section::factory()->create(['key' => 'about', 'sort_order' => 1]);
        $experiences = [
            Experience::factory()->create(['sort_order' => 2]),
            Experience::factory()->create(['sort_order' => 0]),
            Experience::factory()->create(['sort_order' => 2]),
        ];
        $skills = [
            Skill::factory()->create(['sort_order' => 5]),
            Skill::factory()->create(['sort_order' => 1]),
            Skill::factory()->create(['sort_order' => 1]),
        ];
        $projects = [
            Project::factory()->create(['sort_order' => 3]),
            Project::factory()->create(['sort_order' => 0]),
            Project::factory()->create(['sort_order' => 3]),
        ];
        $awards = [
            Award::factory()->create(['sort_order' => 1]),
            Award::factory()->create(['sort_order' => 0]),
        ];

        $data = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame(['boot', 'hero', 'about'], array_column($data['sections'], 'key'));
        $this->assertSame([$experiences[1]->id, $experiences[0]->id, $experiences[2]->id], array_column($data['experiences'], 'id'));
        $this->assertSame([$skills[1]->id, $skills[2]->id, $skills[0]->id], array_column($data['skills'], 'id'));
        $this->assertSame([$projects[1]->id, $projects[0]->id, $projects[2]->id], array_column($data['projects'], 'id'));
        $this->assertSame([$awards[1]->id, $awards[0]->id], array_column($data['awards'], 'id'));
    }

    public function test_query_count_does_not_grow_with_the_number_of_projects(): void
    {
        $this->site(['avatar_media_id' => Media::factory()->create()->id]);
        Section::factory()->create(['key' => 'boot']);
        Experience::factory()->count(2)->create();
        Skill::factory()->soft()->create();
        Award::factory()->count(2)->create();

        $this->project(0);
        $this->project(1);
        $two = $this->countQueries(fn () => $this->getJson(self::URL)->assertOk()->assertJsonCount(2, 'data.projects'));

        foreach (range(2, 5) as $sortOrder) {
            $this->project($sortOrder);
        }
        $six = $this->countQueries(fn () => $this->getJson(self::URL)->assertOk()->assertJsonCount(6, 'data.projects'));

        $this->assertSame($two, $six);
    }

    public function test_an_empty_database_still_returns_the_full_shape(): void
    {
        $data = $this->getJson(self::URL)->assertOk()->json('data');

        $this->assertSame(self::SITE_KEYS, array_keys($data['site']));
        $this->assertSame([], $data['site']['stats']);
        $this->assertSame([], $data['site']['soft_skills']);
        $this->assertSame([], $data['site']['socials']);
        $this->assertNull($data['site']['avatar']);
        $this->assertSame([], $data['sections']);
        $this->assertSame([], $data['experiences']);
        $this->assertSame([], $data['skills']);
        $this->assertSame([], $data['projects']);
        $this->assertSame([], $data['awards']);
    }
}
