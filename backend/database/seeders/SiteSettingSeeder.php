<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;

/**
 * The single site_settings row (id 1). Media fields stay empty: the site shows placeholders.
 * Insert-only: once the row exists it belongs to the admin and a re-seed leaves it alone.
 */
class SiteSettingSeeder extends Seeder
{
    use BuildsSeedRows;

    public function run(): void
    {
        $row = [
            'id' => SiteSetting::ID,
            'full_name' => 'Yehezkiel Natanael',
            'nickname' => 'Hackker',
            'headline' => 'Backend-focused developer',
            'roles' => $this->json(['Backend Developer', 'Laravel Engineer', 'Mobile Explorer', 'Team Lead']),
            'tagline' => 'Building database-driven systems, and now learning to make the front end move.',
            'short_bio' => 'Seventh-semester Informatics student at Universitas Multimedia Nusantara with strong experience '
                .'in web application development using Laravel, specializing in backend systems and database-driven '
                .'applications. Currently expanding into mobile development, with a strong interest in performant, '
                .'user-centric experiences.',
            'location' => 'Tangerang Selatan, Indonesia',
            'email' => 'yehezkielnatanael05@gmail.com',
            'phone' => null,
            'show_phone' => false,
            'socials' => $this->json([
                ['label' => 'GitHub', 'url' => 'https://github.com/hezmaphatos', 'icon' => 'github'],
                ['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/in/yehezkiel-natanael', 'icon' => 'linkedin'],
            ]),
            'stats' => $this->json([
                ['label' => 'GPA', 'value' => '3.91', 'prefix' => '', 'suffix' => '/4.00', 'auto' => null],
                ['label' => 'Semester', 'value' => '7', 'prefix' => '', 'suffix' => '', 'auto' => null],
                // Computed by HomeService from the published project count.
                ['label' => 'Projects', 'value' => '0', 'prefix' => '', 'suffix' => '', 'auto' => 'projects'],
                ['label' => 'Competitions won', 'value' => '2', 'prefix' => '', 'suffix' => '', 'auto' => null],
            ]),
            'seo_title' => 'Yehezkiel Natanael — Backend Developer',
            'seo_description' => 'Informatics student at Universitas Multimedia Nusantara building Laravel backends '
                .'and database-driven apps, now expanding into mobile development.',
            'sound_default' => false,
            'tech_visible_percent' => 50,
            ...$this->timestamps(),
        ];

        SiteSetting::query()->insertOrIgnore([$row]);
    }
}
