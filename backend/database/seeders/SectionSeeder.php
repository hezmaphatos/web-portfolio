<?php

namespace Database\Seeders;

use App\Models\Section;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;

/** The 8 Home chapters with their stage hints (spec §4.1, §5.3). Insert-only: a re-seed adds missing keys only. */
class SectionSeeder extends Seeder
{
    use BuildsSeedRows;

    /** key => [title, hint], in chapter order (same order as Section::KEYS). */
    private const SECTIONS = [
        'boot' => ['Boot', 'Press START (or Enter) to begin. You can skip anytime.'],
        'hero' => ['PLAYER ONE', 'Grab the sticker and throw it. Scroll down to start walking.'],
        'about' => ['CHARACTER SELECT', 'Click the portrait card to flip it. Keep scrolling to read on.'],
        'journey' => ['QUEST LOG', 'Use the tabs to filter. Tap an entry to expand it.'],
        'skills' => ['SKILL TREE', 'Pick up to 4 skills for your loadout: drag a card into a slot, or click it and choose Equip. Test them on the dummy.'],
        'projects' => ['LEVEL SELECT', 'Every project is a boss. Open one and defeat it with your skills to unlock its full tech stack and link.'],
        'trophies' => ['TROPHY ROOM', 'Hover (or tap) a trophy to take a closer look.'],
        'contact' => ['FINAL STAGE', 'Say hi! Send a message to clear the final stage.'],
    ];

    public function run(): void
    {
        $timestamps = $this->timestamps();

        $rows = array_map(
            fn (string $key, int $index): array => [
                'key' => $key,
                'title' => self::SECTIONS[$key][0],
                'hint' => self::SECTIONS[$key][1],
                'sort_order' => $index,
                ...$timestamps,
            ],
            Section::KEYS,
            array_keys(Section::KEYS),
        );

        Section::query()->insertOrIgnore($rows);
    }
}
