<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ValidatesMediaUploads;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/** Multipart `files[]` (1–20) + optional `alt` applied to every file. */
class StoreMediaRequest extends FormRequest
{
    use ValidatesMediaUploads;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => $this->mediaFileRules(),
            'alt' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return $this->mediaFileMessages('files.*');
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $files = $this->file('files');

                if (! is_array($files)) {
                    return;
                }

                foreach ($files as $index => $file) {
                    $this->checkMediaFile($validator, "files.{$index}", $file);
                }
            },
        ];
    }
}
