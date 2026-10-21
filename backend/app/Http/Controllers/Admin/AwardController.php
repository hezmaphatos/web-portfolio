<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReorderRequest;
use App\Http\Requests\Admin\StoreAwardRequest;
use App\Http\Requests\Admin\UpdateAwardRequest;
use App\Services\AwardService;
use Illuminate\Http\JsonResponse;

class AwardController extends Controller
{
    public function __construct(private readonly AwardService $awards) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->awards->adminList()]);
    }

    public function store(StoreAwardRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->awards->create($request->validated())], 201);
    }

    public function show(int $award): JsonResponse
    {
        return response()->json(['data' => $this->awards->find($award)]);
    }

    public function update(UpdateAwardRequest $request, int $award): JsonResponse
    {
        return response()->json(['data' => $this->awards->update($award, $request->validated())]);
    }

    public function destroy(int $award): JsonResponse
    {
        return response()->json(['data' => $this->awards->delete($award)]);
    }

    public function reorder(ReorderRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->awards->reorder($request->validated('items'))]);
    }
}
