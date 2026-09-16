<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_reference_number')->nullable()->after('payment_method');
            $table->enum('payment_status', ['unpaid', 'pending_verification', 'paid', 'rejected'])->default('unpaid')->after('payment_reference_number');
            $table->timestamp('payment_submitted_at')->nullable()->after('payment_status');
            $table->timestamp('payment_verified_at')->nullable()->after('payment_submitted_at');
            $table->foreignId('payment_verified_by')->nullable()->after('payment_verified_at')->constrained('users')->nullOnDelete();
            $table->index('payment_status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['payment_verified_by']);
            $table->dropColumn(['payment_reference_number', 'payment_status', 'payment_submitted_at', 'payment_verified_at', 'payment_verified_by']);
        });
    }
};
