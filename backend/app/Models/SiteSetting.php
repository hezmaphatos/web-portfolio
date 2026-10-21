<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Single row (id = 1). */
#[Fillable([
    'full_name', 'nickname', 'headline', 'roles', 'tagline', 'short_bio', 'long_bio',
    'location', 'email', 'phone', 'show_phone', 'socials', 'stats',
    'avatar_media_id', 'portrait_media_id', 'cv_media_id', 'seo_title', 'seo_description',
    'og_media_id', 'sound_default', 'tech_visible_percent',
])]
class SiteSetting extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'socials' => 'array',
            'stats' => 'array',
            'show_phone' => 'boolean',
            'sound_default' => 'boolean',
            'tech_visible_percent' => 'integer',
        ];
    }

    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'avatar_media_id');
    }

    public function portrait(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'portrait_media_id');
    }

    public function cv(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cv_media_id');
    }

    public function og(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'og_media_id');
    }
}
