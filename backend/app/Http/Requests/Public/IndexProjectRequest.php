<?php

namespace App\Http\Requests\Public;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /public/projects?category=&skill=&q= — `skill` is a skill slug, `q` searches
 * title/tagline/summary. Unknown skill slugs simply match nothing.
 */
class IndexProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category' => ['nullable', Rule::in(Project::CATEGORIES)],
            'skill' => ['nullable', 'string', 'max:120'],
            'q' => ['nullable', 'string', 'max:100'],
        ];
    }
}
