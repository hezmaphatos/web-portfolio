<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ReferencesMedia;
use App\Models\Skill;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

/**
 * Game fields (attack_name, damage, cooldown_ms) are required unless category = soft;
 * for soft skills they are excluded here and stored as null by SkillService.
 */
class StoreSkillRequest extends FormRequest
{
    use ReferencesMedia;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $gameField = ['exclude_if:category,'.Skill::SOFT, 'required'];

        return [
            'name' => ['required', 'string', 'max:80'],
            'slug' => ['nullable', 'string', 'max:100', 'alpha_dash:ascii', 'lowercase', $this->uniqueSlug()],
            'category' => ['required', 'string', Rule::in(Skill::CATEGORIES)],
            'level' => ['sometimes', 'required', 'integer', 'between:1,5'],
            'status' => ['sometimes', 'required', 'string', Rule::in(Skill::STATUSES)],
            'icon_key' => ['nullable', 'string', 'max:50'],
            'icon_media_id' => $this->imageMediaRules(),
            'description' => ['nullable', 'string', 'max:5000'],
            'attack_name' => [...$gameField, 'string', 'max:60'],
            'damage' => [...$gameField, 'integer', 'between:25,70'],
            'cooldown_ms' => [...$gameField, 'integer', 'between:1000,4000', 'multiple_of:500'],
            'is_visible' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ];
    }

    protected function uniqueSlug(): Unique
    {
        return Rule::unique('skills', 'slug');
    }
}
