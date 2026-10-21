<?php

namespace App\Http\Requests\Admin;

use App\Models\Experience;
use Illuminate\Validation\Validator;

/**
 * Same rules as create, but every field is optional: an absent field keeps its value (the admin
 * table toggles `is_visible` alone). A required field that is sent still cannot be blank.
 * after() checks end_date ≥ start_date against the stored row when only one of them is sent.
 */
class UpdateExperienceRequest extends StoreExperienceRequest
{
    public function rules(): array
    {
        return array_map(fn (array $rules) => ['sometimes', ...$rules], parent::rules());
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty() || ($this->has('start_date') && $this->has('end_date'))) {
                    return; // both sent: the after_or_equal rule already decided
                }

                $stored = Experience::query()
                    ->find((int) $this->route('experience'), ['start_date', 'end_date'])
                    ?->toArray();
                if ($stored === null) {
                    return; // ExperienceService answers 404
                }

                $start = $this->has('start_date') ? $this->input('start_date') : $stored['start_date'];
                $end = $this->has('end_date') ? $this->input('end_date') : $stored['end_date'];

                // Both are Y-m-d strings, so string order is date order.
                if ($start !== null && $end !== null && $end < $start) {
                    $validator->errors()->add(
                        'end_date',
                        __('validation.after_or_equal', ['attribute' => 'end date', 'date' => 'start date']),
                    );
                }
            },
        ];
    }
}
