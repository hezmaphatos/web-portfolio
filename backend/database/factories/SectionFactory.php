<?php

namespace Database\Factories;

use App\Models\Section;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Section>
 */
class SectionFactory extends Factory
{
    protected $model = Section::class;

    public function definition(): array
    {
        return [
            'key' => $this->faker->unique()->randomElement(Section::KEYS),
            'title' => strtoupper($this->faker->words(2, true)),
            'subtitle' => null,
            'body' => null,
            'hint' => $this->faker->sentence(),
            'is_visible' => true,
            'sort_order' => 0,
        ];
    }
}
