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
            $table->integer('reserved_quantity')->default(0); // reserved for pending orders
            $table->integer('reorder_level')->default(5); // threshold for low stock alert
            $table->integer('max_stock_level')->nullable(); // warehouse capacity

            // Availability & visibility
            $table->boolean('is_available')->default(true);
            $table->enum('status', ['active', 'inactive', 'seasonal', 'discontinued'])->default('active');

            // Philippine market specifics
            $table->string('batch_number')->nullable(); // for perishable tracking
            $table->date('expiry_date')->nullable(); // expiration for meat, fish, dairy
            $table->date('harvest_date')->nullable(); // for fruits, vegetables
            $table->string('source_location')->nullable(); // e.g., "Navotas Fish Port", "Bulacan Farm"
            $table->enum('storage_type', ['ambient', 'chilled', 'frozen'])->default('ambient');
            $table->decimal('weight_per_unit', 8, 3)->nullable(); // actual weight in kg per unit

            // Pricing adjustments for inventory
            $table->decimal('cost_price', 10, 2)->nullable(); // purchase/wholesale price (puhunan)
            $table->decimal('selling_price', 10, 2); // current selling price
            $table->decimal('markup_percentage', 5, 2)->nullable(); // tubo percentage

            // Supplier info
            $table->string('supplier_name')->nullable(); // suki supplier
            $table->string('supplier_contact')->nullable();

            // Notes
            $table->text('notes')->nullable();
            $table->timestamp('last_restocked_at')->nullable();
            $table->timestamps();

            // Indexes for performance
            $table->index(['vendor_id', 'status']);
            $table->index(['product_id', 'vendor_id']);
            $table->index('expiry_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
