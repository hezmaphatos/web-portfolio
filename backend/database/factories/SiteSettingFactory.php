<?php

namespace Database\Factories;

use App\Models\SiteSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SiteSetting>
 */
class SiteSettingFactory extends Factory
{
    protected $model = SiteSetting::class;

    public function definition(): array
    {
        return [
            'full_name' => 'Yehezkiel Natanael',
            'nickname' => 'Hackker',
            'headline' => 'Backend-focused developer',
            'roles' => ['Backend Developer'],
            'tagline' => 'Tagline',
            'short_bio' => 'Short bio',
            'long_bio' => null,
            'location' => 'Tangerang Selatan, Indonesia',
            'email' => 'hello@example.com',
            'phone' => '+62 800 0000 0000',
            'show_phone' => false,
            'socials' => [],
            'stats' => [],
            'sound_default' => false,
            'tech_visible_percent' => 50,
        ];
    }
}
