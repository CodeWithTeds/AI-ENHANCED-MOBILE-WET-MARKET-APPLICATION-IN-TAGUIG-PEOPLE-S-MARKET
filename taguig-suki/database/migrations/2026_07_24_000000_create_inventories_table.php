<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();

            // Stock levels
            $table->integer('stock_quantity')->default(0);
            $table->integer('reorder_level')->default(5); // threshold for low stock alert
            $table->integer('max_stock_level')->nullable(); // warehouse capacity

            // Pricing adjustments for inventory
            $table->decimal('cost_price', 10, 2)->nullable(); // purchase/wholesale price (puhunan)
            $table->decimal('selling_price', 10, 2); // current selling price
            $table->decimal('markup_percentage', 5, 2)->nullable(); // tubo percentage

            // Status
            $table->enum('status', ['active', 'inactive', 'seasonal', 'discontinued'])->default('active');

            $table->timestamps();

            // Indexes for performance
            $table->index(['vendor_id', 'status']);
            $table->index(['product_id', 'vendor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
