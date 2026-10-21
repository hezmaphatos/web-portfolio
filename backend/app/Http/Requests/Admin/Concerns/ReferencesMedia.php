<?php

namespace App\Http\Requests\Admin\Concerns;

use Illuminate\Database\Query\Builder;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * Rules for a single `*_media_id` field (one query each): the media must exist and be of the kind
 * the public site renders there (an image for cover/avatar/logo/…, a PDF for the CV, a video for
 * the project video).
 */
trait ReferencesMedia
{
    /**
     * @return array<int, mixed>
     */
    protected function imageMediaRules(): array
    {
        return ['nullable', 'integer', $this->mediaOfType('image/')];
    }

    protected function mediaOfType(string $mimePrefix): Exists
    {
        return Rule::exists('media', 'id')->where(fn (Builder $query) => $query->where('mime', 'like', $mimePrefix.'%'));
    }
}
