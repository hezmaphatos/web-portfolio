<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Tells the Next.js site which cached data changed (docs/API.md → "Revalidation webhook").
 * Runs after the response is sent; a failure is logged and never fails the admin request.
 */
class RevalidationService
{
    public const HOME = 'home';

    public const PROJECTS = 'projects';

    public static function projectTag(string $slug): string
    {
        return 'project:'.$slug;
    }

    /**
     * @param  array<int, string>  $tags
     */
    public function revalidate(array $tags): void
    {
        $tags = array_values(array_unique(array_filter($tags, fn ($tag) => is_string($tag) && $tag !== '')));

        if ($tags === []) {
            return;
        }

        defer(fn () => $this->send($tags));
    }

    /** Site settings, skills and media appear on every page. */
    public function revalidateAll(): void
    {
        $this->revalidate([self::HOME, self::PROJECTS]);
    }

    public function revalidateHome(): void
    {
        $this->revalidate([self::HOME]);
    }

    /**
     * @param  array<int, string>  $slugs  current slug, plus the old one after a rename
     */
    public function revalidateProjects(array $slugs = []): void
    {
        $this->revalidate(array_merge(
            [self::HOME, self::PROJECTS],
            array_map(fn ($slug) => self::projectTag((string) $slug), $slugs),
        ));
    }

    /**
     * @param  array<int, string>  $tags
     */
    public function send(array $tags): void
    {
        $secret = (string) config('portfolio.revalidate_secret');

        if ($secret === '') {
            Log::warning('Revalidation skipped: REVALIDATE_SECRET is not set.', ['tags' => $tags]);

            return;
        }

        try {
            $response = Http::timeout(3)
                ->acceptJson()
                ->withHeaders(['x-revalidate-secret' => $secret])
                ->post(config('portfolio.frontend_url').'/api/revalidate', ['tags' => $tags]);

            if ($response->failed()) {
                Log::warning('Revalidation failed.', ['tags' => $tags, 'status' => $response->status()]);
            }
        } catch (Throwable $e) {
            Log::warning('Revalidation failed.', ['tags' => $tags, 'error' => $e->getMessage()]);
        }
    }
}
