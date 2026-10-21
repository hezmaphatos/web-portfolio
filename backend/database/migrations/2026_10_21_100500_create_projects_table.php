<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('title');
            $table->string('tagline')->nullable();
            $table->string('category', 20)->default('web')->index();
            $table->string('kind', 20)->default('personal');
            $table->string('progress', 20)->default('shipped');
            $table->string('status', 10)->default('draft')->index();
            $table->string('role')->nullable();
            $table->unsignedTinyInteger('team_size')->nullable();
            $table->unsignedSmallInteger('year_start')->nullable();
            $table->unsignedSmallInteger('year_end')->nullable();

            $table->text('summary')->nullable();
            $table->text('problem')->nullable();
            $table->text('solution')->nullable();
            $table->text('impact')->nullable();
            $table->longText('description')->nullable();
            $table->json('highlights')->nullable();
            $table->json('challenges')->nullable();

            $table->string('live_url', 500)->nullable();
            $table->string('repo_url', 500)->nullable();
            $table->string('video_url', 500)->nullable();
            $table->foreignId('video_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->boolean('allow_iframe_preview')->default(false);
            $table->string('accent_color', 7)->default('#FF4B2B');
            $table->foreignId('cover_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->boolean('is_featured')->default(false)->index();
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('defeat_count')->default(0);

            $table->boolean('boss_enabled')->default(true);
            $table->string('boss_tier', 10)->default('regular');
            $table->string('boss_name', 80)->nullable();
            $table->unsignedSmallInteger('boss_hp')->default(100);
            $table->foreignId('boss_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('boss_intro', 200)->nullable();
            $table->string('boss_defeat_text', 200)->nullable();

            $table->string('seo_title')->nullable();
            $table->string('seo_description', 300)->nullable();
            $table->foreignId('og_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
