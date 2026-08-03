<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('order_number')->unique(); // e.g. ORD-20260803-0001
            $table->enum('status', [
                'pending',
                'confirmed',
                'processing',
                'ready',
                'completed',
                'cancelled',
            ])->default('pending');

            $table->decimal('total_amount', 10, 2);
            $table->string('payment_method')->default('cash'); // cash, gcash, maya
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
