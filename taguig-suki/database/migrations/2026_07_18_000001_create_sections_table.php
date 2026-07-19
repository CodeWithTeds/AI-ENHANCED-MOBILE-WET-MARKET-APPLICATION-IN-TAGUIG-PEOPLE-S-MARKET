<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('color')->nullable(); // hex color for badge
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Change stalls.section from enum to foreign key
        Schema::table('stalls', function (Blueprint $table) {
            $table->foreignId('section_id')->nullable()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('stalls', function (Blueprint $table) {
            $table->dropColumn('section_id');
        });

        Schema::dropIfExists('sections');
    }
};
