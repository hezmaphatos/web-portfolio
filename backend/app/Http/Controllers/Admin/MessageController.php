<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IndexMessageRequest;
use App\Http\Requests\Admin\MarkMessageReadRequest;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;

class MessageController extends Controller
{
    public function __construct(private readonly MessageService $messages) {}

    /** Paginated: the Service returns `{ data, meta }`. */
    public function index(IndexMessageRequest $request): JsonResponse
    {
        return response()->json($this->messages->paginate($request->validated()));
    }

    public function show(int $message): JsonResponse
    {
        return response()->json(['data' => $this->messages->find($message)]);
    }

    public function read(MarkMessageReadRequest $request, int $message): JsonResponse
    {
        return response()->json(['data' => $this->messages->markRead($message, $request->boolean('read'))]);
    }

    public function destroy(int $message): JsonResponse
    {
        return response()->json(['data' => $this->messages->delete($message)]);
    }
}
