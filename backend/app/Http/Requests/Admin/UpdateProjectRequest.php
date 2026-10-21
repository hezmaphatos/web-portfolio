<?php

namespace App\Http\Requests\Admin;

use App\Models\Project;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Update a project: the store rules, but every field is optional (omitted = unchanged) and the
 * slug is unique ignoring this project. An empty slug is regenerated from the title.
 *
 * "status = published requires a summary" and "year_end ≥ year_start" are (re)checked in after()
 * against the stored row merged with the sent fields, because a partial update may send only one side.
 */
class UpdateProjectRequest extends StoreProjectRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => $this->slugRules(Rule::unique('projects', 'slug')->ignore((int) $this->route('project'))),
            'summary' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    public function after(): array
    {
        return [...parent::after(), fn (Validator $validator) => $this->checkMergedState($validator)];
    }

    private function checkMergedState(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $stored = Project::query()
            ->find((int) $this->route('project'), ['status', 'summary', 'year_start', 'year_end'])
            ?->toArray();
        if ($stored === null) {
            return; // ProjectService answers 404
        }

        $value = fn (string $key) => $this->has($key) ? $this->input($key) : $stored[$key];

        if ($value('status') === 'published' && blank($value('summary'))) {
            $validator->errors()->add('summary', 'A published project needs a summary.');
        }

        $start = $value('year_start');
        $end = $value('year_end');
        if ($start !== null && $end !== null && (int) $end < (int) $start) {
            $validator->errors()->add('year_end', 'The year end field must be greater than or equal to year start.');
        }
    }
}
