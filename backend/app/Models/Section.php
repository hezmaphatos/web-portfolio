<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** One row per Home chapter; the set of keys and their order are fixed (spec §4.1). */
#[Fillable(['key', 'title', 'subtitle', 'body', 'hint', 'is_visible', 'sort_order'])]
class Section extends Model
{
    use HasFactory;

    public const KEYS = ['boot', 'hero', 'about', 'journey', 'skills', 'projects', 'trophies', 'contact'];

    protected function casts(): array
    {
        return [
            'is_visible' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
