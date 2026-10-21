<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ValidatesMediaUploads;
use App\Models\Media;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Multipart `file`: the new content for an existing media id. The new file must be the same kind
 * (image/video/pdf) as the stored one: references were checked by kind when assigned (cover = image,
 * cv = PDF, …), and a replace must not bypass that.
 */
class ReplaceMediaRequest extends FormRequest
{
    use ValidatesMediaUploads;

    private const KIND_LABELS = ['image' => 'an image', 'video' => 'a video', 'pdf' => 'a PDF'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => $this->mediaFileRules(),
        ];
    }

    public function messages(): array
    {
        return $this->mediaFileMessages('file');
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->checkMediaFile($validator, 'file', $this->file('file')),
            function (Validator $validator) {
                if ($validator->errors()->has('file')) {
                    return;
                }

                $stored = Media::query()->find((int) $this->route('media'), ['mime'])?->toArray();
                if ($stored === null) {
                    return; // MediaService answers 404
                }

                $kind = Media::kindOf((string) $stored['mime']);
                if (Media::kindOf((string) $this->file('file')->getMimeType()) !== $kind) {
                    $label = self::KIND_LABELS[$kind] ?? 'file';
                    $validator->errors()->add('file', "The new file must be {$label}, like the one it replaces.");
                }
            },
        ];
    }
}
