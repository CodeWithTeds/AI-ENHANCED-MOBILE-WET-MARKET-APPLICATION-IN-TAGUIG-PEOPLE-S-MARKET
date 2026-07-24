<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            // Movement details
            $table->enum('type', [
                'restock',       // Bagong dating (new stock arrival)
                'sold',          // Nabenta (sold to customer)
                'returned',      // Binalik (customer return)
                'spoiled',       // Nasira (spoilage/waste — common for wet market)
                'adjustment',    // Manual adjustment/correction
                'reserved',      // Reserved for pending order
                'unreserved',    // Released from reservation
                'transferred',   // Moved to another stall
                'initial',       // Opening/initial stock
            ]);

            $table->integer('quantity_before');
            $table->integer('quantity_change'); // positive for in, negative for out
            $table->integer('quantity_after');

            // Context
            $table->string('reason')->nullable(); // e.g., "Morning delivery", "Expired batch"
            $table->string('reference_number')->nullable(); // order ID, delivery receipt, etc.
            $table->decimal('unit_cost', 10, 2)->nullable(); // cost at time of transaction
            $table->string('performed_by')->nullable(); // who did the action

            $table->timestamps();

            // Indexes for reporting
            $table->index(['vendor_id', 'created_at']);
            $table->index(['product_id', 'type']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_logs');
    }
};
