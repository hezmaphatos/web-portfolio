<?php

namespace Database\Factories;

use App\Models\Experience;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Experience>
 */
class ExperienceFactory extends Factory
{
    protected $model = Experience::class;

    public function definition(): array
    {
        return [
            'type' => 'work',
            'title' => $this->faker->jobTitle(),
            'organization' => $this->faker->company(),
            'location' => $this->faker->city(),
            'subtitle' => null,
            'start_date' => '2025-01-01',
            'end_date' => null,
            'description' => null,
            'bullets' => [$this->faker->sentence()],
            'metrics' => [],
            'is_visible' => true,
            'sort_order' => 0,
        ];
    }

    public function hidden(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }
}
