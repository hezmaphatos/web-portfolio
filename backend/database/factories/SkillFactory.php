<?php

namespace Database\Factories;

use App\Models\Skill;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Skill>
 */
class SkillFactory extends Factory
{
    protected $model = Skill::class;

    public function definition(): array
    {
        $name = ucfirst($this->faker->unique()->word()).' '.$this->faker->unique()->numberBetween(1, 99999);

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'category' => $this->faker->randomElement(['backend', 'frontend', 'mobile', 'database']),
            'level' => 3,
            'status' => 'core',
            'icon_key' => null,
            'description' => null,
            'attack_name' => $this->faker->words(2, true),
            'damage' => 40,
            'cooldown_ms' => 2000,
            'is_visible' => true,
            'sort_order' => 0,
        ];
    }

    public function soft(): static
    {
        return $this->state(fn () => [
            'category' => 'soft',
            'attack_name' => null,
            'damage' => null,
            'cooldown_ms' => null,
        ]);
    }

    public function hidden(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }
}
