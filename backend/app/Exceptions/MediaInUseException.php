<?php

namespace App\Exceptions;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Deleting a media row that is still referenced: 409 with the references (docs/API.md → Media).
 */
class MediaInUseException extends RuntimeException implements ShouldntReport
{
    /**
     * @param  array<int, array{type: string, id: int, label: string, field: string}>  $usedIn
     */
    public function __construct(public readonly array $usedIn)
    {
        parent::__construct('Media is in use.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'used_in' => $this->usedIn], 409);
    }
}
