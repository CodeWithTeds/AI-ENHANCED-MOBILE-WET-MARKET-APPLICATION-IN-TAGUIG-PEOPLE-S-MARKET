<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AI-generated recipe recommendations — every Gemini recipe search is
     * logged here so admins can monitor and manage what the AI produces.
     */
    public function up(): void
    {
        Schema::create('recipe_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // The user's original search query
            $table->string('query');

            // The generated dish name (null when the search was not found / failed)
            $table->string('recipe_name')->nullable();

            // found | not_found | error
            $table->string('status')->default('found')->index();

            // Full AI response payload (description, servings, times, ingredients, steps, tips)
            $table->json('payload')->nullable();

            // Ingredients matched against available marketplace products
            $table->json('matching_products')->nullable();

            // Why generation failed (for status = error)
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->index('recipe_name');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_recommendations');
    }
};
