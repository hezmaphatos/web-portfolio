<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\AwardController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ExperienceController;
use App\Http\Controllers\Admin\MediaController;
use App\Http\Controllers\Admin\MessageController;
use App\Http\Controllers\Admin\ProjectController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\Admin\SiteController;
use App\Http\Controllers\Admin\SkillController;
use App\Http\Controllers\Public\ContactController;
use App\Http\Controllers\Public\HomeController;
use App\Http\Controllers\Public\ProjectController as PublicProjectController;
use Illuminate\Support\Facades\Route;

/*
| Response contract: docs/API.md. Prefix /api is added by the framework.
*/

Route::prefix('v1')->group(function () {

    Route::prefix('public')->group(function () {
        Route::get('home', HomeController::class);
        Route::get('projects', [PublicProjectController::class, 'index']);
        Route::get('projects/{slug}', [PublicProjectController::class, 'show']);
        Route::post('projects/{slug}/view', [PublicProjectController::class, 'view'])->middleware('throttle:public-hit');
        Route::post('projects/{slug}/defeat', [PublicProjectController::class, 'defeat'])->middleware('throttle:public-hit');
        Route::post('contact', ContactController::class)->middleware('throttle:contact');
    });

    Route::prefix('admin')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:admin-login');

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::put('password', [AuthController::class, 'password']);

            Route::get('dashboard', DashboardController::class);

            Route::get('site', [SiteController::class, 'show']);
            Route::put('site', [SiteController::class, 'update']);

            Route::get('sections', [SectionController::class, 'index']);
            Route::get('sections/{section}', [SectionController::class, 'show']);
            Route::put('sections/{section}', [SectionController::class, 'update']);

            Route::post('experiences/reorder', [ExperienceController::class, 'reorder']);
            Route::apiResource('experiences', ExperienceController::class);

            Route::post('skills/reorder', [SkillController::class, 'reorder']);
            Route::apiResource('skills', SkillController::class);

            Route::post('projects/reorder', [ProjectController::class, 'reorder']);
            Route::apiResource('projects', ProjectController::class);

            Route::post('awards/reorder', [AwardController::class, 'reorder']);
            Route::apiResource('awards', AwardController::class);

            Route::get('media', [MediaController::class, 'index']);
            Route::post('media', [MediaController::class, 'store']);
            Route::get('media/{media}', [MediaController::class, 'show']);
            Route::patch('media/{media}', [MediaController::class, 'update']);
            Route::post('media/{media}/replace', [MediaController::class, 'replace']);
            Route::delete('media/{media}', [MediaController::class, 'destroy']);

            Route::get('messages', [MessageController::class, 'index']);
            Route::get('messages/{message}', [MessageController::class, 'show']);
            Route::patch('messages/{message}/read', [MessageController::class, 'read']);
            Route::delete('messages/{message}', [MessageController::class, 'destroy']);
        });
    });
});
