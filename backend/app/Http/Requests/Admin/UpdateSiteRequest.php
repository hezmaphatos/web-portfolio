<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ReferencesMedia;
use App\Models\SiteSetting;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSiteRequest extends FormRequest
{
    use ReferencesMedia;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $text = ['nullable', 'string', 'max:255'];
        $image = $this->imageMediaRules();

        return [
            'full_name' => ['required', 'string', 'max:255'],
            'nickname' => ['required', 'string', 'max:60'],
            'headline' => $text,
            'roles' => ['nullable', 'array', 'max:20'],
            'roles.*' => ['required', 'string', 'max:100'],
            'tagline' => $text,
            'short_bio' => ['nullable', 'string', 'max:5000'],
            'long_bio' => ['nullable', 'string', 'max:50000'],
            'location' => $text,
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'show_phone' => ['sometimes', 'boolean'],
            'socials' => ['nullable', 'array', 'max:20'],
            'socials.*.label' => ['required', 'string', 'max:60'],
            'socials.*.url' => ['required', 'url', 'max:500'],
            'socials.*.icon' => ['nullable', 'string', 'max:40'],
            'stats' => ['nullable', 'array', 'max:12'],
            'stats.*.label' => ['required', 'string', 'max:60'],
            'stats.*.value' => ['nullable', 'string', 'max:30'],
            'stats.*.prefix' => ['nullable', 'string', 'max:20'],
            'stats.*.suffix' => ['nullable', 'string', 'max:20'],
            'stats.*.auto' => ['nullable', Rule::in(SiteSetting::STAT_AUTO)],
            'avatar_media_id' => $image,
            'portrait_media_id' => $image,
            'cv_media_id' => ['nullable', 'integer', $this->mediaOfType('application/pdf')],
            'seo_title' => $text,
            'seo_description' => ['nullable', 'string', 'max:300'],
            'og_media_id' => $image,
            'sound_default' => ['sometimes', 'boolean'],
            'tech_visible_percent' => ['sometimes', 'integer', 'between:0,100'],
        ];
    }

    /** Stat values are display text ("3.91", "1,000"); a JSON number is accepted as its string. */
    protected function prepareForValidation(): void
    {
        $stats = $this->input('stats');

        if (! is_array($stats)) {
            return;
        }

        $this->merge(['stats' => array_map(
            fn ($stat) => is_array($stat) && (is_int($stat['value'] ?? null) || is_float($stat['value'] ?? null))
                ? ['value' => (string) $stat['value']] + $stat
                : $stat,
            $stats,
        )]);
    }
}
