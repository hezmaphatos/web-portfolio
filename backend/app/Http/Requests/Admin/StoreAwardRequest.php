<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ReferencesMedia;
use App\Models\Award;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAwardRequest extends FormRequest
{
    use ReferencesMedia;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'event' => ['required', 'string', 'max:255'],
            'issuer' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'between:1990,2100'],
            // Absent = column default (participant).
            'placement' => ['sometimes', Rule::in(Award::PLACEMENTS)],
            'category' => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:5000'],
            // Certificate image (spec §7 "gambar sertifikat").
            'media_id' => $this->imageMediaRules(),
            'url' => ['nullable', 'url', 'max:500'],
            'is_visible' => ['sometimes', 'boolean'],
            // Empty = append after the last row.
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
