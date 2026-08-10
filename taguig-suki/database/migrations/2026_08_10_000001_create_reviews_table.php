<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reviews — customers rate vendors, products, and AI recipes.
     * Vendor/product reviews are only allowed from COMPLETED orders.
     */
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();

            // Morph target: App\Models\Vendor | App\Models\Product (null for recipes)
            $table->nullableMorphs('reviewable');
            $table->string('recipe_name')->nullable(); // for recipe reviews (AI, not order-linked)

            $table->unsignedTinyInteger('rating'); // 1-5 stars
            $table->text('comment')->nullable();

            $table->timestamps();

            // One review per user per target
            $table->unique(['user_id', 'reviewable_type', 'reviewable_id']);
            $table->unique(['user_id', 'recipe_name']);

            $table->index(['reviewable_type', 'reviewable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
