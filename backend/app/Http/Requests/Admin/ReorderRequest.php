<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Body: { "items": [{ "id": 1, "sort_order": 0 }, …] }. Existence of the ids is checked
 * by the Service in one query (an `exists` rule per item would query once per row).
 */
class ReorderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'items.*.sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
