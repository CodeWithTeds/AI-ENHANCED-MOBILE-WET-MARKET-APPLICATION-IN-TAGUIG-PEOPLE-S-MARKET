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
        Schema::create('vendor_contract_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->string('type', 30); // 'renewal', 'cancellation'
            $table->unsignedTinyInteger('requested_duration_months')->nullable(); // 1, 3, 6, 12
            $table->string('status', 30)->default('pending'); // 'pending', 'approved', 'rejected'
            $table->text('reason')->nullable();
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['vendor_id', 'status']);
            $table->index(['type', 'status']);
        });

        Schema::table('vendors', function (Blueprint $table) {
            if (!Schema::hasColumn('vendors', 'cancellation_requested_at')) {
                $table->timestamp('cancellation_requested_at')->nullable()->after('renewal_requested_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vendor_contract_requests');

        Schema::table('vendors', function (Blueprint $table) {
            if (Schema::hasColumn('vendors', 'cancellation_requested_at')) {
                $table->dropColumn('cancellation_requested_at');
            }
        });
    }
};
