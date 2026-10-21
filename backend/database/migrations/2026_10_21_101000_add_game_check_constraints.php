<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Game data rules (spec §8) as DB constraints. MySQL only: SQLite cannot add
     * CHECK constraints to an existing table, and the Form Requests enforce the same rules.
     */
    private const CHECKS = [
        'skills' => [
            'skills_damage_range' => 'damage IS NULL OR damage BETWEEN 25 AND 70',
            'skills_cooldown_range' => 'cooldown_ms IS NULL OR (cooldown_ms BETWEEN 1000 AND 4000 AND cooldown_ms % 500 = 0)',
            'skills_level_range' => 'level BETWEEN 1 AND 5',
        ],
        'projects' => [
            'projects_boss_hp_range' => 'boss_hp BETWEEN 10 AND 300',
            'projects_boss_tier_enum' => "boss_tier IN ('minion', 'regular', 'final')",
        ],
        'site_settings' => [
            'site_settings_tech_visible_range' => 'tech_visible_percent BETWEEN 0 AND 100',
        ],
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        foreach (self::CHECKS as $table => $checks) {
            foreach ($checks as $name => $expression) {
                DB::statement("ALTER TABLE `{$table}` ADD CONSTRAINT `{$name}` CHECK ({$expression})");
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        foreach (self::CHECKS as $table => $checks) {
            foreach (array_keys($checks) as $name) {
                DB::statement("ALTER TABLE `{$table}` DROP CHECK `{$name}`");
            }
        }
    }
};
