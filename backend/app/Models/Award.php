<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'title', 'event', 'issuer', 'year', 'placement', 'category', 'description', 'media_id',
    'url', 'is_visible', 'sort_order',
])]
class Award extends Model
{
    use HasFactory;

    public const PLACEMENTS = ['gold', 'silver', 'bronze', 'finalist', 'participant'];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }
}
