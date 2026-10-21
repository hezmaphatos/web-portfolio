<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'slug', 'title', 'tagline', 'category', 'kind', 'progress', 'status', 'role', 'team_size',
    'year_start', 'year_end', 'summary', 'problem', 'solution', 'impact', 'description',
    'highlights', 'challenges', 'live_url', 'repo_url', 'video_url', 'video_media_id',
    'allow_iframe_preview', 'accent_color', 'cover_media_id', 'is_featured',
    'boss_enabled', 'boss_tier', 'boss_name', 'boss_hp', 'boss_media_id', 'boss_intro',
    'boss_defeat_text', 'seo_title', 'seo_description', 'og_media_id', 'sort_order',
])]
class Project extends Model
{
    use HasFactory;

    public const CATEGORIES = ['web', 'mobile', 'ml', 'game', 'other'];

    public const KINDS = ['personal', 'team', 'internship', 'client', 'community'];

    public const PROGRESS = ['shipped', 'in_progress', 'archived'];

    public const STATUSES = ['draft', 'published'];

    public const DEVICES = ['desktop', 'tablet', 'mobile'];

    /** Boss tiers and their default HP (spec §6.4). */
    public const BOSS_TIERS = ['minion' => 50, 'regular' => 100, 'final' => 150];

    protected function casts(): array
    {
        return [
            'team_size' => 'integer',
            'year_start' => 'integer',
            'year_end' => 'integer',
            'highlights' => 'array',
            'challenges' => 'array',
            'allow_iframe_preview' => 'boolean',
            'is_featured' => 'boolean',
            'view_count' => 'integer',
            'defeat_count' => 'integer',
            'boss_enabled' => 'boolean',
            'boss_hp' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /** Tech stack in reveal order. */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class)
            ->withPivot('sort_order')
            ->withTimestamps()
            ->orderByPivot('sort_order');
    }

    public function gallery(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'project_media')
            ->withPivot('device', 'caption', 'sort_order')
            ->withTimestamps()
            ->orderByPivot('sort_order');
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'video_media_id');
    }

    public function bossSprite(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'boss_media_id');
    }

    public function og(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'og_media_id');
    }
}
