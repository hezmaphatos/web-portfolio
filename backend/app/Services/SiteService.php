<?php

namespace App\Services;

use App\Models\SiteSetting;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Profile & site settings, a single row (id 1): admin GET/PUT and the public `site` object
 * of `/public/home` (docs/API.md → Site). HomeService adds `soft_skills` and fills `auto` stats.
 */
class SiteService
{
    private const RELATIONS = ['avatar', 'portrait', 'cv', 'og'];

    /** Minimal row created when it is missing (fresh install before seeding). */
    private const DEFAULTS = ['full_name' => 'Your Name', 'nickname' => 'Player'];

    public function __construct(
        private readonly MediaService $media,
        private readonly RevalidationService $revalidation,
    ) {}

    /**
     * The public `site` object, without `soft_skills`; `stats` exactly as stored (normalised).
     *
     * @return array<string, mixed>
     */
    public function publicSite(): array
    {
        return $this->presentPublic($this->row());
    }

    /**
     * Every column (arrays normalised to []) plus the four Media objects.
     *
     * @return array<string, mixed>
     */
    public function find(): array
    {
        return $this->presentAdmin($this->row());
    }

    /**
     * @param  array<string, mixed>  $data  validated UpdateSiteRequest data
     * @return array<string, mixed>
     */
    public function update(array $data): array
    {
        if (array_key_exists('roles', $data)) {
            $data['roles'] = $this->strings($data['roles']);
        }
        if (array_key_exists('socials', $data)) {
            $data['socials'] = $this->socials($data['socials']);
        }
        if (array_key_exists('stats', $data)) {
            $data['stats'] = $this->stats($data['stats']);
        }

        $site = SiteSetting::query()->find(SiteSetting::ID) ?? $this->createDefaultRow();
        $site->update($data);

        $this->revalidation->revalidateAll();

        return $this->find();
    }

    /**
     * The settings row with its media relations, created first when missing.
     *
     * @return array<string, mixed>
     */
    private function row(): array
    {
        $row = SiteSetting::query()->with(self::RELATIONS)->find(SiteSetting::ID)?->toArray();

        if ($row !== null) {
            return $row;
        }

        $this->createDefaultRow();

        return SiteSetting::query()->with(self::RELATIONS)->findOrFail(SiteSetting::ID)->toArray();
    }

    private function createDefaultRow(): SiteSetting
    {
        try {
            return SiteSetting::query()->forceCreate(['id' => SiteSetting::ID] + self::DEFAULTS);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request created it first.
            return SiteSetting::query()->findOrFail(SiteSetting::ID);
        }
    }

    /**
     * @param  array<string, mixed>  $row  site_settings row with avatar/portrait/cv/og loaded
     * @return array<string, mixed>
     */
    private function presentPublic(array $row): array
    {
        return [
            'full_name' => $row['full_name'],
            'nickname' => $row['nickname'],
            'headline' => $row['headline'],
            'roles' => $this->strings($row['roles']),
            'tagline' => $row['tagline'],
            'short_bio' => $row['short_bio'],
            'long_bio' => $row['long_bio'],
            'location' => $row['location'],
            'email' => $row['email'],
            'phone' => $row['show_phone'] ? $row['phone'] : null,
            'socials' => $this->socials($row['socials']),
            'stats' => $this->stats($row['stats']),
            'avatar' => $this->media->present($row['avatar'] ?? null),
            'portrait' => $this->media->present($row['portrait'] ?? null),
            'cv' => $this->media->present($row['cv'] ?? null),
            'seo_title' => $row['seo_title'],
            'seo_description' => $row['seo_description'],
            'og_image' => $this->media->present($row['og'] ?? null),
            'sound_default' => (bool) $row['sound_default'],
            'tech_visible_percent' => (int) $row['tech_visible_percent'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function presentAdmin(array $row): array
    {
        return array_merge(['id' => (int) $row['id']], $this->presentPublic($row), [
            'phone' => $row['phone'],
            'show_phone' => (bool) $row['show_phone'],
            'avatar_media_id' => $this->id($row['avatar_media_id']),
            'portrait_media_id' => $this->id($row['portrait_media_id']),
            'cv_media_id' => $this->id($row['cv_media_id']),
            'og_media_id' => $this->id($row['og_media_id']),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function strings(mixed $items): array
    {
        $items = is_array($items) ? $items : [];

        return array_values(array_map(
            fn ($item) => (string) $item,
            array_filter($items, fn ($item) => is_scalar($item) && $item !== ''),
        ));
    }

    /**
     * @return array<int, array{label: string, url: string, icon: string|null}>
     */
    private function socials(mixed $items): array
    {
        return array_map(fn (array $item) => [
            'label' => $this->text($item['label'] ?? null),
            'url' => $this->text($item['url'] ?? null),
            'icon' => $this->text($item['icon'] ?? null) ?: null,
        ], $this->items($items));
    }

    /**
     * @return array<int, array{label: string, value: string, prefix: string, suffix: string, auto: string|null}>
     */
    private function stats(mixed $items): array
    {
        return array_map(fn (array $item) => [
            'label' => $this->text($item['label'] ?? null),
            'value' => $this->text($item['value'] ?? null),
            'prefix' => $this->text($item['prefix'] ?? null),
            'suffix' => $this->text($item['suffix'] ?? null),
            'auto' => in_array($item['auto'] ?? null, SiteSetting::STAT_AUTO, true) ? $item['auto'] : null,
        ], $this->items($items));
    }

    /**
     * The array items of a JSON list column (null or junk → []).
     *
     * @return array<int, array<string, mixed>>
     */
    private function items(mixed $items): array
    {
        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private function id(mixed $value): ?int
    {
        return $value !== null ? (int) $value : null;
    }
}
