<?php

namespace Database\Seeders;

use App\Models\Award;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;

/** Trophy room from the CV. No unique key, so rows are only written into an empty table. */
class AwardSeeder extends Seeder
{
    use BuildsSeedRows;

    /** [title, event, description, year, placement, category] in display order. */
    private const AWARDS = [
        ['Gold Medal — National Level, English', 'Indonesian Student Olympiad (OPI)', 'Senior High School level.', 2022, 'gold', 'Olympiad'],
        ['Gold Medal — National Level, Informatics', 'PROMINENSA', 'Senior High School level.', 2022, 'gold', 'Olympiad'],
        ['Participant', 'Joint International Workshop and Competition (JIWC)', null, 2025, 'participant', 'Contest'],
        ['Participant', 'ICP Hackathon 10', null, 2025, 'participant', 'Contest'],
    ];

    public function run(): void
    {
        if (Award::query()->exists()) {
            $this->command?->info('Awards already present: skipped.');

            return;
        }

        $timestamps = $this->timestamps();

        $rows = array_map(
            fn (array $award, int $index): array => [
                'title' => $award[0],
                'event' => $award[1],
                'issuer' => null,
                'description' => $award[2],
                'year' => $award[3],
                'placement' => $award[4],
                'category' => $award[5],
                'sort_order' => $index,
                ...$timestamps,
            ],
            self::AWARDS,
            array_keys(self::AWARDS),
        );

        Award::query()->insert($rows);
    }
}
