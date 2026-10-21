<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReorderRequest;
use App\Http\Requests\Admin\StoreSkillRequest;
use App\Http\Requests\Admin\UpdateSkillRequest;
use App\Services\SkillService;
use Illuminate\Http\JsonResponse;

class SkillController extends Controller
{
    public function __construct(private readonly SkillService $skills) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->skills->adminList()]);
    }

    public function store(StoreSkillRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->skills->create($request->validated())], 201);
    }

    public function show(int $skill): JsonResponse
    {
        return response()->json(['data' => $this->skills->find($skill)]);
    }

    public function update(UpdateSkillRequest $request, int $skill): JsonResponse
    {
        return response()->json(['data' => $this->skills->update($skill, $request->validated())]);
    }

    public function destroy(int $skill): JsonResponse
    {
        return response()->json(['data' => $this->skills->delete($skill)]);
    }

    public function reorder(ReorderRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->skills->reorder($request->validated('items'))]);
    }
}
