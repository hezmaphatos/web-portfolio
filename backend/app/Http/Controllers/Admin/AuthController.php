<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LoginRequest;
use App\Http\Requests\Admin\UpdatePasswordRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->auth->login($request->validated('email'), $request->validated('password')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->auth->logout($request->user())]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->auth->me($request->user())]);
    }

    public function password(UpdatePasswordRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->auth->updatePassword($request->user(), $request->validated('password')),
        ]);
    }
}
