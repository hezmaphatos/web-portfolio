<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'name', 'slug', 'category', 'level', 'status', 'icon_key', 'icon_media_id', 'description',
    'attack_name', 'damage', 'cooldown_ms', 'is_visible', 'sort_order',
])]
class Skill extends Model
{
    use HasFactory;

    public const CATEGORIES = ['backend', 'frontend', 'mobile', 'database', 'design', 'ml', 'game', 'soft'];

    public const STATUSES = ['core', 'learning'];

    /** Soft skills are shown as chips in About and are never game skills. */
    public const SOFT = 'soft';

    /** Battle data, required unless category = soft (then always null). */
    public const GAME_FIELDS = ['attack_name', 'damage', 'cooldown_ms'];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'damage' => 'integer',
            'cooldown_ms' => 'integer',
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function icon(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'icon_media_id');
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class)->withPivot('sort_order')->withTimestamps();
    }
}
