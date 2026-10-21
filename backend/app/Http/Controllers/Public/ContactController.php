<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ContactRequest;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;

class ContactController extends Controller
{
    public function __construct(private readonly MessageService $messages) {}

    public function __invoke(ContactRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->messages->submit($request->validated(), $request->ip(), $request->userAgent()),
        ], 201);
    }
}
