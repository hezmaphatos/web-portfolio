<?php

namespace App\Services;

/**
 * The single `/public/home` payload (docs/API.md → `GET /public/home`), composed from the
 * public lists of each resource Service. Only visible/published content, each list by sort_order, id.
 */
class HomeService
{
    /** `site.stats[].auto` value whose stat shows the published project count. */
    private const AUTO_PROJECTS = 'projects';

    public function __construct(
        private readonly SiteService $site,
        private readonly SectionService $sections,
        private readonly ExperienceService $experiences,
        private readonly SkillService $skills,
        private readonly ProjectService $projects,
        private readonly AwardService $awards,
    ) {}

    /**
     * @return array{site: array<string, mixed>, sections: array<int, array<string, mixed>>, experiences: array<int, array<string, mixed>>, skills: array<int, array<string, mixed>>, projects: array<int, array<string, mixed>>, awards: array<int, array<string, mixed>>}
     */
    public function payload(): array
    {
        return [
            'site' => $this->site(),
            'sections' => $this->sections->publicList(),
            'experiences' => $this->experiences->publicList(),
            'skills' => $this->skills->publicList(),
            'projects' => $this->projects->publicSummaries(),
            'awards' => $this->awards->publicList(),
        ];
    }

    /**
     * The public site object with the computed stats and `soft_skills` placed right after `stats`.
     *
     * @return array<string, mixed>
     */
    private function site(): array
    {
        $site = $this->site->publicSite();
        $site['stats'] = $this->fillAutoStats($site['stats']);

        $afterStats = array_search('stats', array_keys($site), true) + 1;

        return array_slice($site, 0, $afterStats, true)
            + ['soft_skills' => $this->skills->softSkillNames()]
            + array_slice($site, $afterStats, null, true);
    }

    /**
     * Replaces the value of every `auto = projects` stat by the published project count,
     * counted once (and only when such a stat exists).
     *
     * @param  array<int, array<string, mixed>>  $stats
     * @return array<int, array<string, mixed>>
     */
    private function fillAutoStats(array $stats): array
    {
        $isAuto = fn (array $stat) => $stat['auto'] === self::AUTO_PROJECTS;

        if (array_filter($stats, $isAuto) === []) {
            return $stats;
        }

        $count = (string) $this->projects->publishedCount();

        return array_map(fn (array $stat) => $isAuto($stat) ? array_merge($stat, ['value' => $count]) : $stat, $stats);
    }
}
