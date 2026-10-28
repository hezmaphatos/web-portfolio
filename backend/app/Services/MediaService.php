<?php

namespace App\Services;

use App\Exceptions\MediaInUseException;
use App\Models\Award;
use App\Models\Experience;
use App\Models\Media;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\Skill;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Decoders\FilePathImageDecoder;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;
use RuntimeException;
use Throwable;

/**
 * Uploads, image processing, usage lookup and the Media payload shape (docs/API.md → Media).
 *
 * Other Services call present()/presentMany() on eager-loaded media arrays
 * (`->with('cover')->get()->toArray()` gives `['cover' => [...]|null]`).
 */
class MediaService
{
    /** site_settings column => used_in field. */
    private const SITE_REFS = [
        'avatar_media_id' => 'avatar',
        'portrait_media_id' => 'portrait',
        'cv_media_id' => 'cv',
        'og_media_id' => 'og',
    ];

    /** projects column => used_in field (the gallery lives in project_media). */
    private const PROJECT_REFS = [
        'cover_media_id' => 'cover',
        'video_media_id' => 'video',
        'boss_media_id' => 'boss',
        'og_media_id' => 'og',
    ];

    private ?ImageManager $images = null;

    public function __construct(private readonly RevalidationService $revalidation) {}

    /**
     * Admin library page, newest first.
     *
     * @param  array{q?: string|null, type?: string|null, page?: int|string|null, per_page?: int|string|null}  $filters
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, int>}
     */
    public function index(array $filters): array
    {
        $query = Media::query()->latest()->orderByDesc('id');

        $search = trim((string) ($filters['q'] ?? ''));
        if ($search !== '') {
            $query->where(fn (Builder $where) => $where
                ->where('original_name', 'like', "%{$search}%")
                ->orWhere('alt', 'like', "%{$search}%"));
        }

        match ($filters['type'] ?? null) {
            'image' => $query->where('mime', 'like', 'image/%'),
            'video' => $query->where('mime', 'like', 'video/%'),
            'pdf' => $query->where('mime', 'application/pdf'),
            default => null,
        };

        $page = $query->paginate(
            perPage: (int) ($filters['per_page'] ?? 24),
            page: (int) ($filters['page'] ?? 1),
        )->toArray();

        $usedIn = $this->usedIn(array_column($page['data'], 'id'));

        return [
            'data' => array_map(
                fn (array $media) => $this->presentAdmin($media, $usedIn[(int) $media['id']] ?? []),
                $page['data'],
            ),
            'meta' => [
                'current_page' => (int) $page['current_page'],
                'last_page' => (int) $page['last_page'],
                'per_page' => (int) $page['per_page'],
                'total' => (int) $page['total'],
            ],
        ];
    }

    /**
     * @return array<string, mixed> admin Media with used_in
     */
    public function show(int $id): array
    {
        $media = Media::query()->findOrFail($id)->toArray();

        return $this->presentAdmin($media, $this->usedIn([$id])[$id] ?? []);
    }

    /**
     * Processes every file first, then inserts all rows in one statement.
     * A file that cannot be processed removes everything written so far and fails with 422.
     *
     * @param  array<int, UploadedFile>  $files
     * @return array<int, array<string, mixed>> admin Media, in upload order
     */
    public function store(array $files, ?string $alt = null): array
    {
        $rows = [];
        $written = [];
        $now = now();

        foreach (array_values($files) as $index => $file) {
            $rows[] = $this->storeOrFail($file, "files.{$index}", $written)
                + ['alt' => $alt, 'created_at' => $now, 'updated_at' => $now];
        }

        try {
            Media::query()->insert($rows);
        } catch (Throwable $e) {
            $this->deleteFiles($written);

            throw $e;
        }

        $created = array_column(
            Media::query()->whereIn('path', array_column($rows, 'path'))->get()->toArray(),
            null,
            'path',
        );

        // No revalidation: a new upload is not referenced by any public content yet.
        return array_map(fn (array $row) => $this->presentAdmin($created[$row['path']]), $rows);
    }

    /**
     * @param  array{alt?: string|null}  $data
     * @return array<string, mixed> admin Media
     */
    public function update(int $id, array $data): array
    {
        $media = Media::query()->findOrFail($id);
        $media->update(['alt' => $data['alt'] ?? null]);

        $this->revalidation->revalidateAll();

        return $this->presentAdmin($media->toArray());
    }

    /**
     * Same id (references keep working), new files; the old files are removed from both disks.
     * ReplaceMediaRequest only accepts a file of the same kind (image/video/pdf), so a cover never turns into a PDF.
     *
     * @return array<string, mixed> admin Media
     */
    public function replace(int $id, UploadedFile $file): array
    {
        $media = Media::query()->findOrFail($id);
        $old = $media->toArray();

        $written = [];
        $attributes = $this->storeOrFail($file, 'file', $written);

        try {
            $media->update($attributes);
        } catch (Throwable $e) {
            $this->deleteFiles($written);

            throw $e;
        }

        $this->deleteFiles($this->filesOf($old));
        $this->revalidation->revalidateAll();

        return $this->presentAdmin($media->toArray());
    }

    /**
     * @return array{ok: true}
     *
     * @throws MediaInUseException while anything still references the media
     */
    public function destroy(int $id): array
    {
        $media = Media::query()->findOrFail($id)->toArray();

        $usedIn = $this->usedIn([$id])[$id] ?? [];
        if ($usedIn !== []) {
            throw new MediaInUseException($usedIn);
        }

        Media::query()->whereKey($id)->delete();
        $this->deleteFiles($this->filesOf($media));
        // No revalidation: only unused media can be deleted, so no public content changes.

        return ['ok' => true];
    }

    /**
     * Every reference to the given media ids: one query per referencing table, whatever the number of ids.
     *
     * @param  array<int, int|string>  $ids
     * @return array<int, array<int, array{type: string, id: int, label: string, field: string}>> keyed by media id
     */
    public function usedIn(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }

        $wanted = array_flip($ids);
        $refs = [];

        $sites = SiteSetting::query()
            ->where(fn (Builder $where) => $this->whereAnyIn($where, array_keys(self::SITE_REFS), $ids))
            ->get(['id', ...array_keys(self::SITE_REFS)])
            ->toArray();
        $this->collectRefs($refs, $wanted, $sites, 'site', self::SITE_REFS, null);

        $projects = Project::query()
            ->where(fn (Builder $where) => $this->whereAnyIn($where, array_keys(self::PROJECT_REFS), $ids))
            ->orderBy('id')
            ->get(['id', 'title', ...array_keys(self::PROJECT_REFS)])
            ->toArray();
        $this->collectRefs($refs, $wanted, $projects, 'project', self::PROJECT_REFS, 'title');

        $gallery = Project::query()
            ->join('project_media', 'project_media.project_id', '=', 'projects.id')
            ->whereIn('project_media.media_id', $ids)
            ->orderBy('projects.id')
            ->get(['projects.id', 'projects.title', 'project_media.media_id'])
            ->toArray();
        $this->collectRefs($refs, $wanted, $gallery, 'project', ['media_id' => 'gallery'], 'title');

        $experiences = Experience::query()
            ->whereIn('logo_media_id', $ids)
            ->orderBy('id')
            ->get(['id', 'title', 'logo_media_id'])
            ->toArray();
        $this->collectRefs($refs, $wanted, $experiences, 'experience', ['logo_media_id' => 'logo'], 'title');

        $skills = Skill::query()
            ->whereIn('icon_media_id', $ids)
            ->orderBy('id')
            ->get(['id', 'name', 'icon_media_id'])
            ->toArray();
        $this->collectRefs($refs, $wanted, $skills, 'skill', ['icon_media_id' => 'icon'], 'name');

        $awards = Award::query()
            ->whereIn('media_id', $ids)
            ->orderBy('id')
            ->get(['id', 'title', 'media_id'])
            ->toArray();
        $this->collectRefs($refs, $wanted, $awards, 'award', ['media_id' => 'media'], 'title');

        return $refs;
    }

    /**
     * Admin Media shape: public Media + bookkeeping (+ used_in on index/show).
     *
     * @param  array<string, mixed>  $media  a `media` row as array
     * @param  array<int, array<string, mixed>>|null  $usedIn
     * @return array<string, mixed>
     */
    public function presentAdmin(array $media, ?array $usedIn = null): array
    {
        $row = $this->present($media) + [
            'has_original' => ! empty($media['original_path']),
            'original_name' => $media['original_name'],
            'size' => (int) $media['size'],
            'created_at' => $media['created_at'],
            'updated_at' => $media['updated_at'],
        ];

        if ($usedIn !== null) {
            $row['used_in'] = $usedIn;
        }

        return $row;
    }

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

    /**
     * Writes one upload; on failure removes everything in $written and throws a 422 on $key.
     *
     * @param  array<int, array{0: string, 1: string}>  $written  [disk, path] of every file written so far
     * @return array<string, mixed> media columns except alt and timestamps
     */
    private function storeOrFail(UploadedFile $file, string $key, array &$written): array
    {
        try {
            return $this->storeFile($file, $written);
        } catch (Throwable $e) {
            $this->deleteFiles($written);
            $written = [];

            Log::warning('Media upload could not be processed.', [
                'name' => $file->getClientOriginalName(),
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                $key => "{$file->getClientOriginalName()} could not be processed.",
            ]);
        }
    }

    /**
     * JPEG/PNG/WebP → WebP ≤ max_width + thumb (original kept on the private disk);
     * GIF → kept as is (animation intact) + thumb from the first frame; PDF/video → stored as is.
     *
     * @param  array<int, array{0: string, 1: string}>  $written
     * @return array<string, mixed>
     */
    private function storeFile(UploadedFile $file, array &$written): array
    {
        $mime = (string) $file->getMimeType();
        $extension = strtolower($file->getClientOriginalExtension());
        $base = 'media/'.now()->format('Y/m').'/'.Str::uuid();

        $row = [
            'disk' => $this->disk(),
            'path' => "{$base}.{$extension}",
            'original_path' => null,
            'thumb_path' => null,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime' => $mime,
            'size' => (int) $file->getSize(),
            'width' => null,
            'height' => null,
            'blur_data_url' => null,
            'dominant_color' => null,
        ];

        if (Media::kindOf($mime) !== 'image') {
            $this->write($this->disk(), $row['path'], $file, $written);

            return $row;
        }

        $config = config('portfolio.media');
        // Decoding applies the EXIF orientation (autoOrientation); GIFs decode to their first frame only.
        $image = $this->images()->read($file->getRealPath(), FilePathImageDecoder::class);

        if ($mime === 'image/gif') {
            $row['width'] = $image->width();
            $row['height'] = $image->height();
            $previews = $this->previews($image, $config);
            $this->write($this->disk(), $row['path'], $file, $written);
        } else {
            // Re-encoding through GD drops every metadata block, EXIF included.
            $served = (string) $image->scaleDown(width: (int) $config['max_width'])
                ->toWebp(quality: (int) $config['webp_quality']);
            $row['width'] = $image->width();
            $row['height'] = $image->height();
            $previews = $this->previews($image, $config);

            $row['original_path'] = $row['path'];
            $row['path'] = "{$base}.webp";
            $row['mime'] = 'image/webp';
            $row['size'] = strlen($served);

            $this->write($this->originalsDisk(), $row['original_path'], $file, $written);
            $this->write($this->disk(), $row['path'], $served, $written);
        }

        $row['thumb_path'] = "{$base}-thumb.webp";
        $this->write($this->disk(), $row['thumb_path'], $previews['thumb'], $written);

        return array_merge($row, [
            'blur_data_url' => $previews['blur_data_url'],
            'dominant_color' => $previews['dominant_color'],
        ]);
    }

    /**
     * Thumb, blur placeholder and dominant colour, each derived from the previous (smaller) step.
     * Mutates $image.
     *
     * @param  array<string, mixed>  $config
     * @return array{thumb: string, blur_data_url: string, dominant_color: string}
     */
    private function previews(ImageInterface $image, array $config): array
    {
        $thumb = (string) $image->scaleDown(width: (int) $config['thumb_width'])
            ->toWebp(quality: (int) $config['webp_quality']);

        $blur = $image->scaleDown(width: (int) $config['blur_width'])->toWebp(quality: 40)->toDataUri();

        // Resampling to a single pixel averages the whole image; the first six hex digits are RGB.
        $color = '#'.substr($image->resize(1, 1)->pickColor(0, 0)->toHex(), 0, 6);

        return ['thumb' => $thumb, 'blur_data_url' => $blur, 'dominant_color' => $color];
    }

    /** Served files (WebP renditions, GIF/PDF/video uploads). */
    private function disk(): string
    {
        return (string) config('portfolio.media.disk', 'public');
    }

    /** Untouched image uploads (still carrying EXIF): private, never given a URL. */
    private function originalsDisk(): string
    {
        return (string) config('portfolio.media.originals_disk', 'local');
    }

    private function images(): ImageManager
    {
        return $this->images ??= new ImageManager(new GdDriver, autoOrientation: true, decodeAnimation: false);
    }

    /**
     * @param  array<int, array{0: string, 1: string}>  $written
     */
    private function write(string $disk, string $path, UploadedFile|string $contents, array &$written): void
    {
        $stored = $contents instanceof UploadedFile
            ? Storage::disk($disk)->putFileAs(dirname($path), $contents, basename($path))
            : Storage::disk($disk)->put($path, $contents);

        if ($stored === false) {
            throw new RuntimeException("Could not write [{$path}] to the [{$disk}] disk.");
        }

        $written[] = [$disk, $path];
    }

    /**
     * @param  array<string, mixed>  $media
     * @return array<int, array{0: string, 1: string}>
     */
    private function filesOf(array $media): array
    {
        return array_values(array_filter([
            [$media['disk'], $media['path']],
            [$media['disk'], $media['thumb_path']],
            [$this->originalsDisk(), $media['original_path']],
        ], fn (array $file) => ! empty($file[1])));
    }

    /**
     * @param  array<int, array{0: string, 1: string}>  $files
     */
    private function deleteFiles(array $files): void
    {
        $byDisk = [];
        foreach ($files as [$disk, $path]) {
            $byDisk[$disk][] = $path;
        }

        foreach ($byDisk as $disk => $paths) {
            Storage::disk($disk)->delete($paths);
        }
    }

    /**
     * @param  array<int, string>  $columns
     * @param  array<int, int>  $ids
     */
    private function whereAnyIn(Builder $where, array $columns, array $ids): void
    {
        foreach ($columns as $column) {
            $where->orWhereIn($column, $ids);
        }
    }

    /**
     * Adds a used_in entry for every (row, column) pointing at one of the wanted media ids.
     *
     * @param  array<int, array<int, array<string, mixed>>>  $refs
     * @param  array<int, int>  $wanted  media id => anything
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<string, string>  $columns  column => used_in field
     */
    private function collectRefs(array &$refs, array $wanted, array $rows, string $type, array $columns, ?string $labelKey): void
    {
        foreach ($rows as $row) {
            foreach ($columns as $column => $field) {
                $mediaId = $row[$column] === null ? null : (int) $row[$column];

                if ($mediaId !== null && isset($wanted[$mediaId])) {
                    $refs[$mediaId][] = [
                        'type' => $type,
                        'id' => (int) $row['id'],
                        'label' => $labelKey === null ? 'Site settings' : (string) $row[$labelKey],
                        'field' => $field,
                    ];
                }
            }
        }
    }
}
