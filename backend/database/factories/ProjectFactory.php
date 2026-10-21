<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        $title = ucfirst($this->faker->unique()->words(3, true));

        return [
            'slug' => Str::slug($title),
            'title' => $title,
            'tagline' => $this->faker->sentence(),
            'category' => 'web',
            'kind' => 'personal',
            'progress' => 'shipped',
            'status' => 'published',
            'role' => 'Developer',
            'team_size' => null,
            'year_start' => 2025,
            'year_end' => null,
            'summary' => $this->faker->paragraph(),
            'problem' => null,
            'solution' => null,
            'impact' => null,
            'description' => null,
            'highlights' => [],
            'challenges' => [],
            'live_url' => 'https://example.com',
            'repo_url' => null,
            'video_url' => null,
            'allow_iframe_preview' => false,
            'accent_color' => '#FF4B2B',
            'is_featured' => false,
            'boss_enabled' => true,
            'boss_tier' => 'regular',
            'boss_name' => null,
            'boss_hp' => 100,
            'boss_intro' => null,
            'boss_defeat_text' => null,
            'sort_order' => 0,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft']);
    }

    public function featured(): static
    {
        return $this->state(fn () => ['is_featured' => true]);
    }

    public function withoutBoss(): static
    {
        return $this->state(fn () => ['boss_enabled' => false]);
    }
}
