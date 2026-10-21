<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Single row (id = 1).
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('full_name');
            $table->string('nickname', 60);
            $table->string('headline')->nullable();
            $table->json('roles')->nullable();
            $table->string('tagline')->nullable();
            $table->text('short_bio')->nullable();
            $table->longText('long_bio')->nullable();
            $table->string('location')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->boolean('show_phone')->default(false);
            $table->json('socials')->nullable();
            $table->json('stats')->nullable();
            $table->foreignId('avatar_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('portrait_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->foreignId('cv_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 300)->nullable();
            $table->foreignId('og_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->boolean('sound_default')->default(false);
            $table->unsignedTinyInteger('tech_visible_percent')->default(50);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
