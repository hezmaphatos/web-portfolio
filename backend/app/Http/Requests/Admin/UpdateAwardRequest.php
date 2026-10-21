<?php

namespace App\Http\Requests\Admin;

/**
 * Same rules as create, but every field is optional: an absent field keeps its value (the admin
 * table toggles `is_visible` alone). A required field that is sent still cannot be blank.
 */
class UpdateAwardRequest extends StoreAwardRequest
{
    public function rules(): array
    {
        return array_map(fn (array $rules) => ['sometimes', ...$rules], parent::rules());
    }
}
