<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'type', 'title', 'organization', 'location', 'subtitle', 'start_date', 'end_date',
    'description', 'bullets', 'metrics', 'logo_media_id', 'is_visible', 'sort_order',
])]
class Experience extends Model
{
    use HasFactory;

    public const TYPES = ['work', 'internship', 'freelance', 'organization', 'education'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'bullets' => 'array',
            'metrics' => 'array',
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function logo(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'logo_media_id');
    }
}
