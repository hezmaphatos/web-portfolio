<?php

namespace Database\Factories;

use App\Models\Award;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Award>
 */
class AwardFactory extends Factory
{
    protected $model = Award::class;

    public function definition(): array
    {
        return [
            'title' => 'Participant',
            'event' => $this->faker->words(3, true),
            'issuer' => null,
            'year' => 2025,
            'placement' => 'participant',
            'category' => 'Contest',
            'description' => null,
            'url' => null,
            'is_visible' => true,
            'sort_order' => 0,
        ];
    }

    public function hidden(): static
    {
        return $this->state(fn () => ['is_visible' => false]);
    }
}
