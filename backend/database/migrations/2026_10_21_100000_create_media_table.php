<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->string('disk', 32)->default('public');
            // Served file: WebP (max 1920 px wide) for raster images, the upload itself otherwise.
            $table->string('path');
            // Untouched upload, images only, on the private `local` disk (it still has EXIF;
            // `path` and `thumb_path` are re-encoded without it).
            $table->string('original_path')->nullable();
            $table->string('thumb_path')->nullable();
            $table->string('original_name');
            $table->string('mime', 100)->index();
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('alt')->nullable();
            $table->text('blur_data_url')->nullable();
            $table->string('dominant_color', 7)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
