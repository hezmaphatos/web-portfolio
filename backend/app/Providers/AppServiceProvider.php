<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('admin-login', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('public-hit', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
        RateLimiter::for('contact', fn (Request $request) => Limit::perHour(5)->by($request->ip()));

        // No implicit model binding: controllers receive plain ids/slugs and Services look them up.
        Route::patterns([
            'experience' => '[0-9]+',
            'skill' => '[0-9]+',
            'project' => '[0-9]+',
            'award' => '[0-9]+',
            'section' => '[0-9]+',
            'media' => '[0-9]+',
            'message' => '[0-9]+',
            'slug' => '[a-z0-9]+(?:-[a-z0-9]+)*',
        ]);
    }
}
