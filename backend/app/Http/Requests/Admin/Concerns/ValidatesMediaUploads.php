<?php

namespace App\Http\Requests\Admin\Concerns;

use App\Models\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

/**
 * Upload rules shared by StoreMediaRequest and ReplaceMediaRequest (docs/API.md → Media).
 * The real mime (mimetypes, read from the content) and the extension are both whitelisted;
 * the after() hook then checks that they belong together, applies the per-kind size limit and,
 * for images, the pixel limit (read from the header, before GD decodes the whole bitmap: a small
 * 20000×20000 PNG would otherwise exhaust memory_limit with a fatal error).
 */
trait ValidatesMediaUploads
{
    /**
     * @return array<int, string>
     */
    protected function mediaFileRules(): array
    {
        $limits = config('portfolio.media');

        return [
            'required',
            'file',
            'mimetypes:'.implode(',', array_keys(Media::TYPES)),
            'extensions:'.implode(',', array_merge(...array_values(Media::TYPES))),
            'max:'.max((int) $limits['image_max_kb'], (int) $limits['pdf_max_kb'], (int) $limits['video_max_kb']),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function mediaFileMessages(string $attribute): array
    {
        $allowed = 'Allowed files: JPG, PNG, WebP, GIF, PDF, MP4 and WebM (SVG is not accepted).';

        return [
            "{$attribute}.mimetypes" => $allowed,
            "{$attribute}.extensions" => $allowed,
        ];
    }

    protected function checkMediaFile(Validator $validator, string $key, mixed $file): void
    {
        if (! $file instanceof UploadedFile || $validator->errors()->has($key)) {
            return;
        }

        $mime = (string) $file->getMimeType();
        $name = $file->getClientOriginalName();

        if (! in_array(strtolower($file->getClientOriginalExtension()), Media::TYPES[$mime] ?? [], true)) {
            $validator->errors()->add($key, "The extension of {$name} does not match its content.");

            return;
        }

        $limitKb = (int) config('portfolio.media.'.Media::kindOf($mime).'_max_kb');

        if ($file->getSize() > $limitKb * 1024) {
            $validator->errors()->add($key, sprintf('%s must not be larger than %d MB.', $name, $limitKb / 1024));

            return;
        }

        if (Media::kindOf($mime) === 'image') {
            // An unreadable header is left to processing, which answers 422 "could not be processed".
            $size = @getimagesize($file->getRealPath());
            $maxPixels = (int) config('portfolio.media.max_pixels');

            if ($size !== false && $maxPixels < $size[0] * $size[1]) {
                $validator->errors()->add($key, sprintf(
                    '%s is %d×%d px; images may have at most %s megapixels.',
                    $name,
                    $size[0],
                    $size[1],
                    rtrim(rtrim(number_format($maxPixels / 1_000_000, 2), '0'), '.'),
                ));
            }
        }
    }
}
