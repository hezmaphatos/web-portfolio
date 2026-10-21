<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Initial content from the CV (spec Lampiran A). Every seeder is idempotent and, except
 * AdminUserSeeder, insert-only: re-running `db:seed` adds what is missing and never
 * overwrites content the admin has edited. AdminUserSeeder resets the admin's email and
 * password to ADMIN_EMAIL / ADMIN_PASSWORD (`db:seed --class=AdminUserSeeder` = password recovery).
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Dependency order: projects link to skills by slug.
        $this->call([
            AdminUserSeeder::class,
            SiteSettingSeeder::class,
            SectionSeeder::class,
            SkillSeeder::class,
            ExperienceSeeder::class,
            ProjectSeeder::class,
            AwardSeeder::class,
        ]);
    }
}
