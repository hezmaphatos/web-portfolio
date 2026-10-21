<?php

namespace Database\Seeders;

use App\Models\Experience;
use Database\Seeders\Concerns\BuildsSeedRows;
use Illuminate\Database\Seeder;

/** Quest log entries from the CV. No unique key, so rows are only written into an empty table. */
class ExperienceSeeder extends Seeder
{
    use BuildsSeedRows;

    public function run(): void
    {
        if (Experience::query()->exists()) {
            $this->command?->info('Experiences already present: skipped.');

            return;
        }

        $timestamps = $this->timestamps();
        $experiences = $this->experiences();

        $rows = array_map(
            fn (array $experience, int $index): array => [
                'type' => $experience['type'],
                'title' => $experience['title'],
                'organization' => $experience['organization'],
                'location' => $experience['location'] ?? null,
                'subtitle' => $experience['subtitle'] ?? null,
                'start_date' => $experience['start_date'],
                'end_date' => $experience['end_date'],
                'bullets' => $this->json($experience['bullets'] ?? []),
                'metrics' => $this->json($experience['metrics'] ?? []),
                'sort_order' => $index,
                ...$timestamps,
            ],
            $experiences,
            array_keys($experiences),
        );

        Experience::query()->insert($rows);
    }

    /** end_date null = present. Month-only CV dates span the whole month. */
    private function experiences(): array
    {
        return [
            [
                'type' => 'internship',
                'title' => 'Software Developer Intern',
                'organization' => 'Unggul Mitra Solusi',
                'location' => 'Jakarta Barat',
                'start_date' => '2026-01-01',
                'end_date' => '2026-07-31',
                'bullets' => [
                    'Built an AI-powered OCR system that automates sales order creation from purchase order documents.',
                    'Built a WhatsApp-based document pipeline integrated with the OCR system for end-to-end sales order creation from WhatsApp messages.',
                    'Contributed full-stack features on a multi-tenant ERP platform and resolved production bugs across backend and frontend.',
                    'Built a mobile admin app to manage subscription and configuration settings across client instances of the ERP platform.',
                ],
            ],
            [
                'type' => 'freelance',
                'title' => 'Sales & Marketing',
                'organization' => 'Universitas Multimedia Nusantara',
                'start_date' => '2025-05-01',
                'end_date' => null,
                'bullets' => [
                    'Followed up prospective students and parents to support enrollment and scholarship processes.',
                    'Provided consultation via chat and phone.',
                    'Coordinated campus tours and supported on-ground marketing events.',
                ],
                'metrics' => [
                    $this->metric('full enrollments', 50, suffix: '+'),
                    $this->metric('first-stage payments', 50, suffix: '+'),
                    $this->metric('scholarship applicants', 150, suffix: '+'),
                ],
            ],
            [
                'type' => 'organization',
                'title' => 'IT Coordinator & Project Leader',
                'organization' => 'Radioactive 2025',
                'start_date' => '2025-02-01',
                'end_date' => '2025-11-30',
                'bullets' => [
                    'Led a 5-member team through planning and delivery of technical work.',
                    'Produced initial UI layout concepts and wireframes.',
                    'Built the merchandise purchasing feature (front end and back end).',
                    'Collaborated with cross-functional teams to meet event requirements and timelines.',
                ],
            ],
            [
                'type' => 'organization',
                'title' => 'IT Member',
                'organization' => 'UMN Radio Gen 14',
                'start_date' => '2024-12-01',
                'end_date' => '2025-12-31',
                'bullets' => [
                    'Ran scheduled monthly data backups.',
                    "Completed the API fetching process for web radio broadcast data, enabling integration with the organization's mobile app.",
                    'Supported the technical infrastructure of campus radio operations.',
                ],
            ],
            [
                'type' => 'organization',
                'title' => 'Member',
                'organization' => 'Campus Visit Gen 12',
                'start_date' => '2024-02-01',
                'end_date' => '2025-03-31',
                'bullets' => [
                    'Led campus tours for groups of ~20 prospective students at education fairs and on-campus events.',
                    'Presented academic programs, facilities, and campus life; followed up on registration.',
                ],
                'metrics' => [
                    $this->metric('events', 60, prefix: '~'),
                    $this->metric('students guided', 1000, prefix: '~'),
                    $this->metric('encouraged to register for entrance tests', 500, prefix: '~'),
                ],
            ],
            [
                'type' => 'internship',
                'title' => 'Social Media Coordinator Intern',
                'organization' => 'Agusta Dryer',
                'location' => 'Jakarta Selatan',
                'start_date' => '2022-11-01',
                'end_date' => '2022-11-30',
                'bullets' => [
                    'Managed YouTube, TikTok, Instagram, and Facebook; led cross-functional content planning and quality monitoring.',
                ],
                'metrics' => [
                    $this->metric('YouTube long-form views', 480),
                    $this->metric('Shorts views', 1.3, suffix: 'K'),
                ],
            ],
            [
                'type' => 'education',
                'title' => 'Bachelor of Computer Science (Informatics)',
                'organization' => 'Universitas Multimedia Nusantara',
                'subtitle' => 'GPA 3.91/4.00',
                'start_date' => '2023-08-01',
                'end_date' => null,
            ],
            [
                'type' => 'education',
                'title' => 'Software Engineering Major',
                'organization' => 'SMKS Cinta Kasih Tzu Chi',
                'subtitle' => 'Average grade 88.61',
                'start_date' => '2020-08-01',
                'end_date' => '2023-08-31',
            ],
        ];
    }

    /** @return array{label: string, value: int|float, prefix: string, suffix: string} */
    private function metric(string $label, int|float $value, string $prefix = '', string $suffix = ''): array
    {
        return ['label' => $label, 'value' => $value, 'prefix' => $prefix, 'suffix' => $suffix];
    }
}
