<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSiteRequest;
use App\Services\SiteService;
use Illuminate\Http\JsonResponse;

class SiteController extends Controller
{
    public function __construct(private readonly SiteService $site) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->site->find()]);
    }

    public function update(UpdateSiteRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->site->update($request->validated())]);
    }
}
