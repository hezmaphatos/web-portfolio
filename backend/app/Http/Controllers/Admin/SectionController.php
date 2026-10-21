<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSectionRequest;
use App\Services\SectionService;
use Illuminate\Http\JsonResponse;

class SectionController extends Controller
{
    public function __construct(private readonly SectionService $sections) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->sections->adminList()]);
    }

    public function show(int $section): JsonResponse
    {
        return response()->json(['data' => $this->sections->find($section)]);
    }

    public function update(UpdateSectionRequest $request, int $section): JsonResponse
    {
        return response()->json(['data' => $this->sections->update($section, $request->validated())]);
    }
}
