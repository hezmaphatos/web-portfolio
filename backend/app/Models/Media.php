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

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
        ];
    }
}
