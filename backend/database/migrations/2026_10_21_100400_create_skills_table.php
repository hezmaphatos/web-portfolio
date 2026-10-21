<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('skills', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
            $table->string('category', 20)->index();
            $table->unsignedTinyInteger('level')->default(3);
            $table->string('status', 10)->default('core');
            $table->string('icon_key', 50)->nullable();
            $table->foreignId('icon_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->text('description')->nullable();
            // Game data; null only for `soft` skills, which are never game skills.
            $table->string('attack_name', 60)->nullable();
            $table->unsignedSmallInteger('damage')->nullable();
            $table->unsignedSmallInteger('cooldown_ms')->nullable();
            $table->boolean('is_visible')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('skills');
    }
};
