<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `key` and `sort_order` are fixed (spec §4.1) and never validated, so never written.
 * Absent fields keep their value, which lets the admin table toggle `is_visible` alone.
 */
class UpdateSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
            'hint' => ['nullable', 'string', 'max:300'],
            'is_visible' => ['sometimes', 'boolean'],
        ];
    }
}
