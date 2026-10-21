<?php

namespace App\Http\Requests\Admin;

use App\Models\Skill;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\Validator;

/**
 * Partial update, like the other resources: every field is optional and an omitted field keeps its
 * value (the admin table toggles `is_visible` alone). A required field that is sent cannot be blank.
 * An omitted `slug` is kept, an empty one is regenerated from the name.
 *
 * "Game fields are required unless category = soft" is checked in after() against the stored row
 * merged with the sent fields (e.g. switching soft → backend must also send the game fields).
 */
class UpdateSkillRequest extends StoreSkillRequest
{
    public function rules(): array
    {
        return array_map(fn (array $rules) => ['sometimes', ...$rules], parent::rules());
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $stored = Skill::query()
                    ->find((int) $this->route('skill'), ['category', ...Skill::GAME_FIELDS])
                    ?->toArray();
                if ($stored === null) {
                    return; // SkillService answers 404
                }

                $value = fn (string $key) => $this->has($key) ? $this->input($key) : $stored[$key];
                if ($value('category') === Skill::SOFT) {
                    return;
                }

                foreach (Skill::GAME_FIELDS as $field) {
                    if (blank($value($field))) {
                        $validator->errors()->add($field, __('validation.required', ['attribute' => str_replace('_', ' ', $field)]));
                    }
                }
            },
        ];
    }

    protected function uniqueSlug(): Unique
    {
        return Rule::unique('skills', 'slug')->ignore((int) $this->route('skill'));
    }
}
