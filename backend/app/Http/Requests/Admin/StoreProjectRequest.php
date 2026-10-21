<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ReferencesMedia;
use App\Models\Media;
use App\Models\Project;
use App\Models\Skill;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\Validator;

/**
 * Create a project (docs/API.md → Projects).
 *
 * `skill_ids[]` and `gallery[].media_id` are checked by the after() hook with one whereIn count
 * per list (an `exists` rule per item would query once per row); gallery items must be images.
 * An empty slug is generated from the title, an omitted boss_hp follows the tier preset.
 */
class StoreProjectRequest extends FormRequest
{
    use ReferencesMedia;

    /** Lowercase kebab-case, the same shape as the public {slug} route pattern. */
    public const SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, youtube-nocookie.com/embed/… */
    public const YOUTUBE_PATTERN = '~^https?://(?:(?:www\.|m\.)?youtube\.com/(?:watch\?(?:[^#\s]*&)?v=|shorts/)|youtu\.be/|(?:www\.)?youtube-nocookie\.com/embed/)[A-Za-z0-9_-]{6,}~i';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => $this->slugRules(Rule::unique('projects', 'slug')),
            'tagline' => ['nullable', 'string', 'max:255'],
            'category' => ['sometimes', 'required', Rule::in(Project::CATEGORIES)],
            'kind' => ['sometimes', 'required', Rule::in(Project::KINDS)],
            'progress' => ['sometimes', 'required', Rule::in(Project::PROGRESS)],
            'status' => ['sometimes', 'required', Rule::in(Project::STATUSES)],
            'role' => ['nullable', 'string', 'max:255'],
            'team_size' => ['nullable', 'integer', 'between:1,255'],
            'year_start' => ['nullable', 'integer', 'between:1990,2100'],
            'year_end' => ['nullable', 'integer', 'between:1990,2100', Rule::when($this->filled('year_start'), 'gte:year_start')],
            'accent_color' => ['sometimes', 'required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_featured' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,65535'],

            'summary' => ['nullable', 'string', 'max:2000', 'required_if:status,published'],
            'problem' => ['nullable', 'string', 'max:16000'],
            'solution' => ['nullable', 'string', 'max:16000'],
            'impact' => ['nullable', 'string', 'max:16000'],
            'description' => ['nullable', 'string', 'max:100000'],
            'highlights' => ['nullable', 'list', 'max:50'],
            'highlights.*' => ['required', 'string', 'max:500'],
            'challenges' => ['nullable', 'list', 'max:50'],
            'challenges.*' => ['required', 'string', 'max:500'],

            'skill_ids' => ['sometimes', 'nullable', 'list', 'max:50'],
            'skill_ids.*' => ['required', 'integer', 'min:1', 'distinct'],

            'boss_enabled' => ['sometimes', 'boolean'],
            'boss_tier' => ['sometimes', 'required', Rule::in(array_keys(Project::BOSS_TIERS))],
            'boss_hp' => ['nullable', 'integer', 'between:10,300'],
            'boss_name' => ['nullable', 'string', 'max:80'],
            'boss_media_id' => ['nullable', 'integer', $this->mediaOfType('image/')],
            'boss_intro' => ['nullable', 'string', 'max:200'],
            'boss_defeat_text' => ['nullable', 'string', 'max:200'],

            'cover_media_id' => ['nullable', 'integer', $this->mediaOfType('image/')],
            'gallery' => ['sometimes', 'nullable', 'list', 'max:100'],
            'gallery.*' => ['array'],
            'gallery.*.media_id' => ['required', 'integer', 'min:1', 'distinct'],
            'gallery.*.device' => ['nullable', Rule::in(Project::DEVICES)],
            'gallery.*.caption' => ['nullable', 'string', 'max:255'],
            'video_url' => ['nullable', 'string', 'max:500', 'url:http,https', 'regex:'.self::YOUTUBE_PATTERN],
            'video_media_id' => ['nullable', 'integer', $this->mediaOfType('video/')],

            'live_url' => ['nullable', 'string', 'max:500', 'url:http,https'],
            'repo_url' => ['nullable', 'string', 'max:500', 'url:http,https'],
            'allow_iframe_preview' => ['sometimes', 'boolean'],

            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'og_media_id' => ['nullable', 'integer', $this->mediaOfType('image/')],
        ];
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'The slug may only contain lowercase letters, numbers and single hyphens.',
            'accent_color.regex' => 'The accent color must be a hex color like #FF4B2B.',
            'video_url.regex' => 'The video URL must be a YouTube link (youtube.com/watch, youtu.be, youtube.com/shorts or youtube-nocookie.com/embed).',
            'summary.required_if' => 'A published project needs a summary.',
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->checkRelatedExist($validator)];
    }

    /** One whereIn count per list; skipped while other errors are pending (the ids may not even be ints). */
    protected function checkRelatedExist(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $skillIds = array_values(array_unique(array_map('intval', (array) $this->input('skill_ids'))));
        if ($skillIds !== [] && Skill::query()->whereKey($skillIds)->count() !== count($skillIds)) {
            $validator->errors()->add('skill_ids', 'One or more selected skills do not exist.');
        }

        $mediaIds = array_values(array_unique(array_map(
            fn (array $item) => (int) $item['media_id'],
            (array) $this->input('gallery'),
        )));
        $images = $mediaIds === [] ? 0 : Media::query()->whereKey($mediaIds)->where('mime', 'like', 'image/%')->count();
        if ($images !== count($mediaIds)) {
            $validator->errors()->add('gallery', 'Gallery items must be existing images.');
        }
    }

    /**
     * @return array<int, mixed>
     */
    protected function slugRules(Unique $unique): array
    {
        return ['nullable', 'string', 'max:120', 'alpha_dash:ascii', 'regex:'.self::SLUG_PATTERN, $unique];
    }
}
