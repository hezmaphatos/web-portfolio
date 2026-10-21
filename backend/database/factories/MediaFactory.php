<?php

namespace Database\Factories;

use App\Models\Media;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Media>
 */
class MediaFactory extends Factory
{
    protected $model = Media::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->lexify('????????');

        return [
            'disk' => 'public',
            'path' => "media/2026/10/{$name}.webp",
            'original_path' => "media/2026/10/originals/{$name}.jpg",
            'thumb_path' => "media/2026/10/{$name}-thumb.webp",
            'original_name' => "{$name}.jpg",
            'mime' => 'image/webp',
            'size' => 123456,
            'width' => 1600,
            'height' => 900,
            'alt' => $this->faker->sentence(3),
            'blur_data_url' => 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4IAoAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==',
            'dominant_color' => '#334455',
        ];
    }

    public function pdf(): static
    {
        return $this->state(fn () => [
            'path' => 'media/2026/10/'.$this->faker->unique()->lexify('????????').'.pdf',
            'original_path' => null,
            'thumb_path' => null,
            'original_name' => 'cv.pdf',
            'mime' => 'application/pdf',
            'width' => null,
            'height' => null,
            'blur_data_url' => null,
            'dominant_color' => null,
        ]);
    }
}
