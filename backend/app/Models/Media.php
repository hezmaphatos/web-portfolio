<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Table('media')]
#[Fillable([
    'disk', 'path', 'original_path', 'thumb_path', 'original_name', 'mime', 'size',
    'width', 'height', 'alt', 'blur_data_url', 'dominant_color',
])]
class Media extends Model
{
    use HasFactory;

    /** Accepted uploads: real mime type => extensions it may carry. SVG is never accepted. */
    public const TYPES = [
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/webp' => ['webp'],
        'image/gif' => ['gif'],
        'application/pdf' => ['pdf'],
        'video/mp4' => ['mp4'],
        'video/webm' => ['webm'],
    ];

    /** Raster images that are re-encoded to WebP (GIF keeps its file and only gets a thumbnail). */
    public const PROCESSED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

    /** `?type=` filter of the admin library. */
    public const KINDS = ['image', 'video', 'pdf'];

    /** image | video | pdf, or null for a mime outside the whitelist. */
    public static function kindOf(string $mime): ?string
    {
        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'video/') => 'video',
            $mime === 'application/pdf' => 'pdf',
            default => null,
        };
    }

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
        ];
    }
}
