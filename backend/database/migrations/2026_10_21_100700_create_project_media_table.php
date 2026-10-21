<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Project gallery. Media in use cannot be deleted (MediaService checks first; restrict is the backstop).
        Schema::create('project_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_id')->constrained('media')->restrictOnDelete();
            $table->string('device', 10)->default('desktop');
            $table->string('caption')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0)->index();
            $table->timestamps();
            $table->unique(['project_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_media');
    }
};
