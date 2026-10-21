<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;
use LogicException;

/**
 * Body: { "items": [{ "id": 1, "sort_order": 0 }, …] }. The after() hook checks that every id exists
 * with one whereIn count (an `exists` rule per item would query once per row).
 * The table is the resource segment of the route: /admin/{experiences|skills|projects|awards}/reorder.
 */
class ReorderRequest extends FormRequest
{
    private const TABLES = ['experiences', 'skills', 'projects', 'awards'];

    public function authorize(): bool
    {
        return true;
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $ids = array_values(array_unique(array_map(
                    fn (array $item) => (int) $item['id'],
                    (array) $this->input('items'),
                )));

                if (DB::table($this->table())->whereIn('id', $ids)->count() !== count($ids)) {
                    $validator->errors()->add('items', 'One or more items do not exist.');
                }
            },
        ];
    }

    private function table(): string
    {
        $segments = explode('/', (string) $this->route()?->uri());
        $table = $segments[count($segments) - 2] ?? '';

        if (! in_array($table, self::TABLES, true)) {
            throw new LogicException("ReorderRequest used on an unknown resource route [{$table}].");
        }

        return $table;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.id' => ['required', 'integer', 'min:1', 'distinct'],
            'items.*.sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
