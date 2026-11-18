<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Item 13: Allow customers to rate a product or vendor per order.
     */
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'reviewable_type', 'reviewable_id']);
            $table->unique(['user_id', 'order_id', 'reviewable_type', 'reviewable_id'], 'reviews_user_order_reviewable_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique('reviews_user_order_reviewable_unique');
            $table->unique(['user_id', 'reviewable_type', 'reviewable_id']);
        });
    }
};
