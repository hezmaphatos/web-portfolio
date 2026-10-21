<?php

namespace Database\Seeders;

use App\Models\Skill;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Game skills (damage + cooldown) followed by the soft skills shown as chips in About.
 * Insert-only (by slug): the game numbers are a starting point the admin tunes, so a re-seed never resets them.
 */
class SkillSeeder extends Seeder
{
    use BuildsSeedRows;

    /**
     * [name, category, level, attack_name, damage, cooldown seconds, icon_key] in Lampiran A order.
     * PostgreSQL is not in the Lampiran A skill table but is part of Mindlens' tech stack;
     * its game numbers are a starting point inside the DPS 16–28 guideline.
     */
    private const GAME_SKILLS = [
        ['HTML', 'frontend', 3, 'Semantic Strike', 25, 1.0, 'html'],
        ['CSS', 'frontend', 3, 'Cascade', 30, 1.5, 'css'],
        ['JavaScript', 'frontend', 3, 'Async Slash', 40, 2.0, 'javascript'],
        ['ReactJS', 'frontend', 3, 'Re-render', 55, 3.0, 'react'],
        ['Tailwind CSS', 'frontend', 3, 'Utility Flurry', 35, 1.5, 'tailwindcss'],
        ['Bootstrap CSS', 'frontend', 3, 'Grid Bash', 26, 1.0, 'bootstrap'],
        ['PHP', 'backend', 3, 'Echo Blast', 45, 2.5, 'php'],
        ['Laravel', 'backend', 5, 'Eloquent Slam', 70, 4.0, 'laravel'],
        ['Kotlin', 'mobile', 3, 'Null Safety', 50, 3.0, 'kotlin'],
        ['Flutter', 'mobile', 3, 'Hot Reload', 60, 3.5, 'flutter'],
        ['MySQL', 'database', 3, 'Join Crush', 65, 3.5, 'mysql'],
        ['Firebase', 'database', 3, 'Realtime Burn', 38, 2.0, 'firebase'],
        ['Figma', 'design', 3, 'Auto Layout', 32, 1.5, 'figma'],
        ['Python', 'ml', 3, 'Import Antigravity', 48, 2.5, 'python'],
        ['C#', 'game', 3, 'Sharp Strike', 42, 2.0, 'csharp'],
        ['PostgreSQL', 'database', 3, 'Vacuum Full', 50, 2.5, 'postgresql'],
    ];

    private const SOFT_SKILLS = [
        'Public Speaking',
        'Communication',
        'Teamwork & Collaboration',
        'Project Management',
        'Marketing',
        'Problem Solving',
    ];

    /** Names whose Str::slug() would be meaningless ('C#' → 'c'). */
    private const SLUG_OVERRIDES = ['C#' => 'csharp'];

    public function run(): void
    {
        $timestamps = $this->timestamps();

        $game = array_map(
            fn (array $skill, int $index): array => [
                'name' => $skill[0],
                'slug' => self::slug($skill[0]),
                'category' => $skill[1],
                'level' => $skill[2],
                'status' => 'core',
                'icon_key' => $skill[6],
                'attack_name' => $skill[3],
                'damage' => $skill[4],
                'cooldown_ms' => (int) round($skill[5] * 1000),
                'sort_order' => $index,
                ...$timestamps,
            ],
            self::GAME_SKILLS,
            array_keys(self::GAME_SKILLS),
        );

        $offset = count(self::GAME_SKILLS);
        $soft = array_map(
            fn (string $name, int $index): array => [
                'name' => $name,
                'slug' => self::slug($name),
                'category' => Skill::SOFT,
                'level' => 3,
                'status' => 'core',
                'icon_key' => null,
                'attack_name' => null,
                'damage' => null,
                'cooldown_ms' => null,
                'sort_order' => $offset + $index,
                ...$timestamps,
            ],
            self::SOFT_SKILLS,
            array_keys(self::SOFT_SKILLS),
        );

        $rows = [...$game, ...$soft];

        Skill::query()->insertOrIgnore($rows);
    }

    public static function slug(string $name): string
    {
        return self::SLUG_OVERRIDES[$name] ?? Str::slug($name);
    }
}
