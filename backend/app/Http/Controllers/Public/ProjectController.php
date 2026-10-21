<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\IndexProjectRequest;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function __construct(private readonly ProjectService $projects) {}

    public function index(IndexProjectRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->projects->publicSummaries($request->validated())]);
    }

    /** A draft is visible only with a valid admin Bearer token (preview); the route itself is public. */
    public function show(Request $request, string $slug): JsonResponse
    {
        return response()->json(['data' => $this->projects->publicDetail($slug, $request->user('sanctum') !== null)]);
    }

    public function view(string $slug): JsonResponse
    {
        return response()->json(['data' => $this->projects->recordView($slug)]);
    }

    public function defeat(string $slug): JsonResponse
    {
        return response()->json(['data' => $this->projects->recordDefeat($slug)]);
    }
}
