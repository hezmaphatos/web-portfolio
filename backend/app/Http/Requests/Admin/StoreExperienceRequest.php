<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ReferencesMedia;
use App\Models\Experience;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExperienceRequest extends FormRequest
{
    use ReferencesMedia;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(Experience::TYPES)],
            'title' => ['required', 'string', 'max:255'],
            'organization' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            // Empty = present (is_current).
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string', 'max:10000'],
            'bullets' => ['nullable', 'array', 'max:30'],
            'bullets.*' => ['required', 'string', 'max:500'],
            'metrics' => ['nullable', 'array', 'max:10'],
            'metrics.*.label' => ['required', 'string', 'max:100'],
            'metrics.*.value' => ['required', 'numeric', 'between:-1000000000,1000000000'],
            'metrics.*.prefix' => ['nullable', 'string', 'max:20'],
            'metrics.*.suffix' => ['nullable', 'string', 'max:20'],
            'logo_media_id' => $this->imageMediaRules(),
            'is_visible' => ['sometimes', 'boolean'],
            // Empty = append after the last row.
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }

    /** Readable names for nested fields ("The metric label field is required.", not "metrics.0.label"). */
    public function attributes(): array
    {
        return [
            'bullets.*' => 'bullet',
            'metrics.*.label' => 'metric label',
            'metrics.*.value' => 'metric value',
            'metrics.*.prefix' => 'metric prefix',
            'metrics.*.suffix' => 'metric suffix',
        ];
    }
}
