<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IndexMediaRequest;
use App\Http\Requests\Admin\ReplaceMediaRequest;
use App\Http\Requests\Admin\StoreMediaRequest;
use App\Http\Requests\Admin\UpdateMediaRequest;
use App\Services\MediaService;
use Illuminate\Http\JsonResponse;

class MediaController extends Controller
{
    public function __construct(private readonly MediaService $mediaService) {}

    public function index(IndexMediaRequest $request): JsonResponse
    {
        $page = $this->mediaService->index($request->validated());

        return response()->json(['data' => $page['data'], 'meta' => $page['meta']]);
    }

    public function store(StoreMediaRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->mediaService->store($request->validated('files'), $request->validated('alt')),
        ], 201);
    }

    public function show(int $media): JsonResponse
    {
        return response()->json(['data' => $this->mediaService->show($media)]);
    }

    public function update(UpdateMediaRequest $request, int $media): JsonResponse
    {
        return response()->json(['data' => $this->mediaService->update($media, $request->validated())]);
    }

    public function replace(ReplaceMediaRequest $request, int $media): JsonResponse
    {
        return response()->json(['data' => $this->mediaService->replace($media, $request->validated('file'))]);
    }

    /** 409 { message, used_in } while the media is referenced (MediaInUseException). */
    public function destroy(int $media): JsonResponse
    {
        return response()->json(['data' => $this->mediaService->destroy($media)]);
    }
}
