<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReorderRequest;
use App\Http\Requests\Admin\StoreProjectRequest;
use App\Http\Requests\Admin\UpdateProjectRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;

class ProjectController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->projects->adminIndex()]);
    }

    public function show(int $project): JsonResponse
    {
        return response()->json(['data' => $this->projects->adminShow($project)]);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->projects->store($request->validated())], 201);
    }

    public function update(UpdateProjectRequest $request, int $project): JsonResponse
    {
        return response()->json(['data' => $this->projects->update($project, $request->validated())]);
    }

    public function destroy(int $project): JsonResponse
    {
        return response()->json(['data' => $this->projects->destroy($project)]);
    }

    public function reorder(ReorderRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->projects->reorder($request->validated('items'))]);
    }
}
