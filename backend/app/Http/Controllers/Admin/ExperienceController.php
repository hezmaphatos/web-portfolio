<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReorderRequest;
use App\Http\Requests\Admin\StoreExperienceRequest;
use App\Http\Requests\Admin\UpdateExperienceRequest;
use App\Services\ExperienceService;
use Illuminate\Http\JsonResponse;

class ExperienceController extends Controller
{
    public function __construct(private readonly ExperienceService $experiences) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->experiences->adminList()]);
    }

    public function store(StoreExperienceRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->experiences->create($request->validated())], 201);
    }

    public function show(int $experience): JsonResponse
    {
        return response()->json(['data' => $this->experiences->find($experience)]);
    }

    public function update(UpdateExperienceRequest $request, int $experience): JsonResponse
    {
        return response()->json(['data' => $this->experiences->update($experience, $request->validated())]);
    }

    public function destroy(int $experience): JsonResponse
    {
        return response()->json(['data' => $this->experiences->delete($experience)]);
    }

    public function reorder(ReorderRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->experiences->reorder($request->validated('items'))]);
    }
}
