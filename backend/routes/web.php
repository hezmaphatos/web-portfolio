<?php

use Illuminate\Support\Facades\Route;

// API only: the site and the admin panel live in the Next.js app.
Route::get('/', fn () => response()->json(['data' => ['name' => config('app.name')]]));
