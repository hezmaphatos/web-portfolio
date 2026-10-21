<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\Skill;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * CV projects, each one a boss (spec Lampiran A). Needs SkillSeeder first: the tech
 * stack is linked by skill slug, in reveal order (project_skill.sort_order).
 *
 * Insert-only: projects whose slug already exists (and their tech links) are left exactly as the
 * admin set them, so a re-seed never republishes a draft or resets the boss numbers.
 */
class ProjectSeeder extends Seeder
{
    use BuildsSeedRows;

    public function run(): void
    {
        $all = $this->projects();
        $existing = array_column(
            Project::query()
                ->whereIn('slug', array_map(fn (array $project) => Str::slug($project['title']), $all))
                ->get(['slug'])
                ->toArray(),
            'slug',
        );
        $projects = array_values(array_filter(
            $all,
            fn (array $project) => ! in_array(Str::slug($project['title']), $existing, true),
        ));

        if ($projects === []) {
            $this->command?->info('Projects already present: skipped.');

            return;
        }

        $timestamps = $this->timestamps();

        $rows = array_map(fn (array $project): array => [
            'slug' => Str::slug($project['title']),
            'title' => $project['title'],
            'tagline' => $project['tagline'],
            'category' => $project['category'],
            'kind' => $project['kind'],
            'progress' => 'shipped',
            'status' => 'published',
            'role' => $project['role'],
            'team_size' => $project['team_size'] ?? null,
            'year_start' => $project['year'],
            'year_end' => null,
            'summary' => $project['summary'],
            'highlights' => $this->json($project['highlights'] ?? []),
            'challenges' => $this->json([]),
            'accent_color' => $project['accent_color'],
            'is_featured' => $project['is_featured'],
            'boss_enabled' => true,
            'boss_tier' => $project['boss'][0],
            'boss_hp' => $project['boss'][1],
            'boss_name' => $project['boss'][2],
            'boss_intro' => $project['boss'][3],
            'boss_defeat_text' => $project['boss'][4],
            'sort_order' => $project['sort_order'],
            ...$timestamps,
        ], $projects);

        $slugs = array_column($rows, 'slug');
        $techSlugs = array_values(array_unique(array_merge(...array_map(
            fn (array $project): array => array_map(SkillSeeder::slug(...), $project['tech']),
            $projects,
        ))));

        DB::transaction(function () use ($rows, $slugs, $techSlugs, $projects, $timestamps): void {
            Project::query()->insert($rows);

            $projectIds = array_column(
                Project::query()->whereIn('slug', $slugs)->get(['id', 'slug'])->toArray(),
                'id',
                'slug',
            );
            $skillIds = array_column(
                Skill::query()->whereIn('slug', $techSlugs)->get(['id', 'slug'])->toArray(),
                'id',
                'slug',
            );

            $missing = array_diff($techSlugs, array_keys($skillIds));
            if ($missing !== []) {
                throw new RuntimeException('Run SkillSeeder first. Missing skills: '.implode(', ', $missing));
            }

            $pivot = [];
            foreach ($projects as $index => $project) {
                foreach (array_values($project['tech']) as $order => $tech) {
                    $pivot[] = [
                        'project_id' => $projectIds[$slugs[$index]],
                        'skill_id' => $skillIds[SkillSeeder::slug($tech)],
                        'sort_order' => $order,
                        ...$timestamps,
                    ];
                }
            }

            DB::table('project_skill')->insert($pivot);
        });
    }

    /**
     * Lampiran A projects. boss = [tier, hp, name, intro, defeat text]; tech in reveal order.
     * Year '—' in the CV → null. Links, story blocks and media are left for the admin.
     */
    private function projects(): array
    {
        return [
            [
                'title' => 'OCR — Internal Document Extraction',
                'tagline' => 'Multimodal AI that turns customer purchase orders into ERP sales orders.',
                'summary' => 'Internal web app that automates Sales Order creation by extracting data from customer '
                    .'Purchase Orders with multimodal AI. UI in Flutter; backend logic connects the AI output to '
                    ."the client's existing ERP.",
                'category' => 'web',
                'kind' => 'internship',
                'year' => 2026,
                'role' => 'Software Developer Intern',
                'accent_color' => '#FF4B2B',
                'is_featured' => true,
                'sort_order' => 2,
                // The OCR-related bullets of the Unggul Mitra Solusi internship.
                'highlights' => [
                    'Built an AI-powered OCR system that automates sales order creation from purchase order documents.',
                    'Built a WhatsApp-based document pipeline integrated with the OCR system for end-to-end sales order creation from WhatsApp messages.',
                ],
                'boss' => ['final', 150, 'The Paper Colossus', 'A mountain of purchase orders blocks the way.', 'Every order is now a sales order.'],
                'tech' => ['Flutter', 'Laravel', 'MySQL', 'Python'],
            ],
            [
                'title' => 'Mindlens',
                'tagline' => 'ML-powered facial analysis app that detects signs of depression.',
                'summary' => 'Mobile app that uses machine learning and facial analysis to detect signs of depression. '
                    .'Includes map-based features and the user profile interface.',
                'category' => 'mobile',
                'kind' => 'personal',
                'year' => null,
                'role' => 'Developer',
                'accent_color' => '#2F4BE8',
                'is_featured' => true,
                'sort_order' => 1,
                'boss' => ['regular', 80, 'The Blind Spot', 'Something is hiding behind the lens.', 'Blind spot cleared.'],
                'tech' => ['Kotlin', 'PostgreSQL', 'Python'],
            ],
            [
                'title' => 'Radioactive 2025 — Event Website',
                'tagline' => 'Event website with merchandise purchasing, deployed to production on Hostinger.',
                'summary' => 'Event website with a merchandise purchasing feature; led the team and deployed to '
                    .'production via cPanel on Hostinger.',
                'category' => 'web',
                'kind' => 'community',
                'year' => 2025,
                'role' => 'Project Lead',
                'team_size' => 5,
                'accent_color' => '#C6F432',
                'is_featured' => true,
                'sort_order' => 0,
                // The Radioactive 2025 organization bullets.
                'highlights' => [
                    'Led a 5-member team through planning and delivery of technical work.',
                    'Produced initial UI layout concepts and wireframes.',
                    'Built the merchandise purchasing feature (front end and back end).',
                    'Collaborated with cross-functional teams to meet event requirements and timelines.',
                ],
                'boss' => ['regular', 100, 'The Reactor', 'The reactor is running hot. Cool it down!', 'Reactor stable. Merch is on sale!'],
                'tech' => ['Laravel', 'Tailwind CSS', 'ReactJS'],
            ],
            [
                'title' => 'ARK Care Ministry',
                'tagline' => 'Church website built with Laravel and Bootstrap.',
                'summary' => 'Church website built with Laravel and Bootstrap; designed the About page and reusable '
                    .'layout templates for other pages.',
                'category' => 'web',
                'kind' => 'community',
                'year' => null,
                'role' => 'Developer',
                'accent_color' => '#FFB627',
                'is_featured' => false,
                'sort_order' => 3,
                'boss' => ['minion', 50, 'The Template Slime', 'A wild Template Slime appears!', 'Slime reused as a layout.'],
                'tech' => ['Laravel', 'Bootstrap CSS'],
            ],
        ];
    }
}
