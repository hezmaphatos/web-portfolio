<?php

namespace Tests\Feature;

use App\Models\Experience;
use App\Models\Project;
use App\Models\Section;
use App\Models\SiteSetting;
use App\Models\Skill;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN_EMAIL = 'admin@example.test';

    private const ADMIN_PASSWORD = 'seeded-password-123';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'portfolio.admin.email' => self::ADMIN_EMAIL,
            'portfolio.admin.password' => self::ADMIN_PASSWORD,
        ]);
    }

    public function test_seeding_twice_does_not_duplicate_rows(): void
    {
        $this->seed();
        $this->seed();

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('site_settings', 1);
        $this->assertDatabaseCount('sections', 8);
        $this->assertDatabaseCount('skills', 22);
        $this->assertSame(16, Skill::query()->where('category', '!=', Skill::SOFT)->count());
        $this->assertSame(6, Skill::query()->where('category', Skill::SOFT)->count());
        $this->assertDatabaseCount('experiences', 8);
        $this->assertDatabaseCount('projects', 4);
        $this->assertDatabaseCount('project_skill', 12);
        $this->assertDatabaseCount('awards', 4);
        $this->assertDatabaseCount('media', 0);
    }

    public function test_admin_user_is_seeded_from_config_with_a_hashed_password(): void
    {
        $this->seed(AdminUserSeeder::class);

        $user = User::query()->where('email', self::ADMIN_EMAIL)->firstOrFail()->toArray();
        $password = User::query()->where('email', self::ADMIN_EMAIL)->value('password');

        $this->assertSame('Admin', $user['name']);
        $this->assertNotSame(self::ADMIN_PASSWORD, $password);
        $this->assertTrue(Hash::check(self::ADMIN_PASSWORD, $password));
    }

    public function test_admin_user_is_skipped_when_credentials_are_missing(): void
    {
        config(['portfolio.admin.password' => null]);

        $this->seed(AdminUserSeeder::class);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_site_settings_match_the_cv(): void
    {
        $this->seed();

        $site = SiteSetting::query()->findOrFail(SiteSetting::ID)->toArray();

        $this->assertSame('Yehezkiel Natanael', $site['full_name']);
        $this->assertSame('Hezki', $site['nickname']);
        $this->assertSame(['Backend Developer', 'Laravel Engineer', 'Mobile Explorer', 'Team Lead'], $site['roles']);
        $this->assertNull($site['phone']);
        $this->assertFalse($site['show_phone']);
        $this->assertFalse($site['sound_default']);
        $this->assertSame(50, $site['tech_visible_percent']);
        $this->assertSame(['GitHub', 'LinkedIn'], array_column($site['socials'], 'label'));
        $this->assertSame(
            ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
            $site['stats'][0],
        );
        $this->assertSame('projects', $site['stats'][2]['auto']);
        $this->assertSame('Yehezkiel Natanael — Backend Developer', $site['seo_title']);
        $this->assertLessThanOrEqual(160, mb_strlen($site['seo_description']));
        $this->assertNull($site['avatar_media_id']);
    }

    public function test_sections_have_titles_and_hints_in_chapter_order(): void
    {
        $this->seed();

        $sections = Section::query()->orderBy('sort_order')->get()->toArray();

        $this->assertSame(Section::KEYS, array_column($sections, 'key'));
        $this->assertSame(range(0, 7), array_column($sections, 'sort_order'));
        $this->assertSame('PLAYER ONE', $sections[1]['title']);
        $this->assertSame('FINAL STAGE', $sections[7]['title']);
        $this->assertSame('Press START (or Enter) to begin. You can skip anytime.', $sections[0]['hint']);
        $this->assertSame(
            'Every project is a boss. Open one and defeat it with your skills to unlock its full tech stack and link.',
            $sections[5]['hint'],
        );
    }

    public function test_skills_carry_game_data_and_soft_skills_do_not(): void
    {
        $this->seed();

        $this->assertDatabaseHas('skills', [
            'slug' => 'laravel', 'category' => 'backend', 'level' => 5, 'attack_name' => 'Eloquent Slam',
            'damage' => 70, 'cooldown_ms' => 4000, 'sort_order' => 7, 'status' => 'core', 'icon_key' => 'laravel',
        ]);
        $this->assertDatabaseHas('skills', ['name' => 'C#', 'slug' => 'csharp', 'category' => 'game', 'cooldown_ms' => 2000]);
        $this->assertDatabaseHas('skills', ['slug' => 'reactjs', 'damage' => 55, 'cooldown_ms' => 3000]);
        $this->assertDatabaseHas('skills', ['slug' => 'tailwind-css', 'cooldown_ms' => 1500]);
        $this->assertDatabaseHas('skills', [
            'slug' => 'public-speaking', 'category' => 'soft', 'attack_name' => null, 'damage' => null, 'cooldown_ms' => null,
        ]);

        $game = Skill::query()->where('category', '!=', Skill::SOFT)->get(['damage', 'cooldown_ms', 'sort_order'])->toArray();
        foreach ($game as $skill) {
            $this->assertGreaterThanOrEqual(25, $skill['damage']);
            $this->assertLessThanOrEqual(70, $skill['damage']);
            $this->assertSame(0, $skill['cooldown_ms'] % 500);
            $this->assertLessThan(16, $skill['sort_order']);
        }
    }

    public function test_experiences_parse_dates_and_metrics(): void
    {
        $this->seed();

        $experiences = Experience::query()->orderBy('sort_order')->get()->toArray();

        $this->assertSame(range(0, 7), array_column($experiences, 'sort_order'));

        $this->assertSame('Unggul Mitra Solusi', $experiences[0]['organization']);
        $this->assertSame('Jakarta Barat', $experiences[0]['location']);
        $this->assertSame('2026-01-01', $experiences[0]['start_date']);
        $this->assertSame('2026-07-31', $experiences[0]['end_date']);
        $this->assertCount(4, $experiences[0]['bullets']);
        $this->assertSame([], $experiences[0]['metrics']);

        $this->assertNull($experiences[1]['end_date']);
        $this->assertSame(
            ['label' => 'full enrollments', 'value' => 50, 'prefix' => '', 'suffix' => '+'],
            $experiences[1]['metrics'][0],
        );
        $this->assertSame(
            ['label' => 'students guided', 'value' => 1000, 'prefix' => '~', 'suffix' => ''],
            $experiences[4]['metrics'][1],
        );
        $this->assertSame('2022-11-30', $experiences[5]['end_date']);
        $this->assertSame(
            ['label' => 'Shorts views', 'value' => 1.3, 'prefix' => '', 'suffix' => 'K'],
            $experiences[5]['metrics'][1],
        );
        $this->assertSame('GPA 3.91/4.00', $experiences[6]['subtitle']);
        $this->assertSame('Average grade 88.61', $experiences[7]['subtitle']);
        $this->assertSame([], $experiences[7]['bullets']);
    }

    public function test_projects_are_published_bosses_with_tech_in_reveal_order(): void
    {
        $this->seed();

        $projects = Project::query()->with('skills')->orderBy('sort_order')->get()->toArray();
        $bySlug = array_column($projects, null, 'slug');

        $this->assertSame(
            ['radioactive-2025-event-website', 'mindlens', 'ocr-internal-document-extraction', 'ark-care-ministry'],
            array_column($projects, 'slug'),
        );
        $this->assertSame(['published'], array_values(array_unique(array_column($projects, 'status'))));
        $this->assertSame([true, true, true, false], array_column($projects, 'is_featured'));
        $this->assertCount(4, array_unique(array_column($projects, 'accent_color')));

        $ocr = $bySlug['ocr-internal-document-extraction'];
        $this->assertSame('final', $ocr['boss_tier']);
        $this->assertSame(150, $ocr['boss_hp']);
        $this->assertSame('The Paper Colossus', $ocr['boss_name']);
        $this->assertTrue($ocr['boss_enabled']);
        $this->assertSame(2026, $ocr['year_start']);
        $this->assertSame(['flutter', 'laravel', 'mysql', 'python'], array_column($ocr['skills'], 'slug'));
        $this->assertSame([0, 1, 2, 3], array_column(array_column($ocr['skills'], 'pivot'), 'sort_order'));
        $this->assertCount(2, $ocr['highlights']);

        $mindlens = $bySlug['mindlens'];
        $this->assertNull($mindlens['year_start']);
        $this->assertSame(80, $mindlens['boss_hp']);
        $this->assertSame(['kotlin', 'postgresql', 'python'], array_column($mindlens['skills'], 'slug'));
        $this->assertSame([], $mindlens['highlights']);

        $radioactive = $bySlug['radioactive-2025-event-website'];
        $this->assertSame('Project Lead', $radioactive['role']);
        $this->assertSame(5, $radioactive['team_size']);
        $this->assertSame(['laravel', 'tailwind-css', 'reactjs'], array_column($radioactive['skills'], 'slug'));

        $ark = $bySlug['ark-care-ministry'];
        $this->assertSame(['minion', 50], [$ark['boss_tier'], $ark['boss_hp']]);
        $this->assertSame(['laravel', 'bootstrap-css'], array_column($ark['skills'], 'slug'));

        foreach ($projects as $project) {
            $this->assertLessThanOrEqual(80, mb_strlen($project['tagline']));
            $this->assertNull($project['live_url']);
            $this->assertNull($project['problem']);
            $this->assertSame([], $project['challenges']);
        }
    }

    public function test_reseeding_keeps_columns_the_seeder_does_not_own(): void
    {
        $this->seed();
        Project::query()->where('slug', 'mindlens')->update(['live_url' => 'https://mindlens.example', 'view_count' => 7]);

        $this->seed();

        $this->assertDatabaseHas('projects', ['slug' => 'mindlens', 'live_url' => 'https://mindlens.example', 'view_count' => 7]);
    }

    public function test_awards_match_the_cv(): void
    {
        $this->seed();

        $this->assertDatabaseHas('awards', [
            'title' => 'Gold Medal — National Level, English', 'event' => 'Indonesian Student Olympiad (OPI)',
            'issuer' => null, 'year' => 2022, 'placement' => 'gold', 'category' => 'Olympiad', 'sort_order' => 0,
        ]);
        $this->assertDatabaseHas('awards', [
            'title' => 'Participant', 'event' => 'ICP Hackathon 10', 'year' => 2025, 'placement' => 'participant',
            'category' => 'Contest', 'sort_order' => 3,
        ]);
    }

    public function test_reseeding_never_overwrites_admin_edits(): void
    {
        $this->seed();
        $mindlens = Project::query()->where('slug', 'mindlens')->firstOrFail();
        $mindlens->update(['status' => 'draft', 'boss_hp' => 222, 'title' => 'Edited']);
        $python = Skill::query()->where('slug', 'python')->value('id');
        DB::table('project_skill')->where('project_id', $mindlens['id'])->where('skill_id', $python)->delete();
        Skill::query()->where('slug', 'laravel')->update(['damage' => 30]);
        SiteSetting::query()->whereKey(SiteSetting::ID)->update(['full_name' => 'Edited Name', 'phone' => '0812', 'show_phone' => true]);
        Section::query()->where('key', 'hero')->update(['title' => 'EDITED', 'hint' => 'Edited hint']);

        $this->seed();

        $this->assertDatabaseHas('projects', ['slug' => 'mindlens', 'status' => 'draft', 'boss_hp' => 222, 'title' => 'Edited']);
        $this->assertDatabaseMissing('project_skill', ['project_id' => $mindlens['id'], 'skill_id' => $python]);
        $this->assertDatabaseHas('skills', ['slug' => 'laravel', 'damage' => 30]);
        $this->assertDatabaseHas('site_settings', ['id' => SiteSetting::ID, 'full_name' => 'Edited Name', 'phone' => '0812', 'show_phone' => true]);
        $this->assertDatabaseHas('sections', ['key' => 'hero', 'title' => 'EDITED', 'hint' => 'Edited hint']);
    }

    public function test_reseeding_adds_a_deleted_seed_project_back_with_its_tech(): void
    {
        $this->seed();
        Project::query()->where('slug', 'mindlens')->firstOrFail()->delete();

        $this->seed();

        $id = Project::query()->where('slug', 'mindlens')->value('id');
        $this->assertNotNull($id);
        $this->assertSame(3, DB::table('project_skill')->where('project_id', $id)->count());
        $this->assertDatabaseCount('projects', 4);
    }

    public function test_changing_admin_email_replaces_the_account_instead_of_adding_one(): void
    {
        $this->seed(AdminUserSeeder::class);
        $stray = User::factory()->create(['email' => 'stray@example.test']);
        $stray->createToken('old');

        config(['portfolio.admin.email' => 'new-admin@example.test', 'portfolio.admin.password' => 'another-password-456']);
        $this->seed(AdminUserSeeder::class);

        $this->assertDatabaseCount('users', 1);
        $user = User::query()->firstOrFail()->toArray();
        $this->assertSame(1, $user['id']);
        $this->assertSame('new-admin@example.test', $user['email']);
        $this->assertTrue(Hash::check('another-password-456', (string) User::query()->value('password')));
        $this->assertDatabaseMissing('users', ['email' => self::ADMIN_EMAIL]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
