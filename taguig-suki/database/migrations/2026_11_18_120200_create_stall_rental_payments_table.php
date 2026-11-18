<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stall_rental_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->foreignId('stall_id')->constrained('stalls')->cascadeOnDelete();
            $table->string('billing_period', 20); // YYYY-MM
            $table->decimal('amount', 10, 2);
            $table->date('due_date');
            $table->timestamp('paid_at')->nullable();
            $table->string('payment_method', 30)->nullable(); // cash, gcash, maya, bank_transfer
            $table->string('payment_reference', 100)->nullable();
            $table->string('proof_path')->nullable();
            $table->string('status', 30)->default('unpaid'); // paid, unpaid, pending, overdue
            $table->text('notes')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stall_rental_payments');
    }
};
