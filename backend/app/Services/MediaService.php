<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * Uploads, image processing, usage lookup and the Media payload shape (docs/API.md → Media).
 *
 * Other Services call present()/presentMany() on eager-loaded media arrays
 * (`->with('cover')->get()->toArray()` gives `['cover' => [...]|null]`).
 */
class MediaService
{
    /**
     * Public Media shape, or null.
     *
     * @param  array<string, mixed>|null  $media  a `media` row as array
     * @return array<string, mixed>|null
     */
    public function present(?array $media): ?array
    {
        if ($media === null || ! isset($media['id'])) {
            return null;
        }

        return [
            'id' => (int) $media['id'],
            'url' => $this->url($media['disk'], $media['path']),
            'thumb_url' => $media['thumb_path'] ? $this->url($media['disk'], $media['thumb_path']) : null,
            'mime' => $media['mime'],
            'width' => $media['width'] !== null ? (int) $media['width'] : null,
            'height' => $media['height'] !== null ? (int) $media['height'] : null,
            'alt' => $media['alt'],
            'blur_data_url' => $media['blur_data_url'],
            'dominant_color' => $media['dominant_color'],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    public function presentMany(array $items): array
    {
        return array_values(array_filter(array_map(fn ($media) => $this->present($media), $items)));
    }

    public function url(string $disk, ?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return Storage::disk($disk)->url($path);
    }
}
