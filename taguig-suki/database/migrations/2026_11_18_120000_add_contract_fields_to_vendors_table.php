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
        Schema::table('vendors', function (Blueprint $table) {
            $table->unsignedInteger('contract_duration_months')->default(12)->after('approved_at');
            $table->date('contract_start_date')->nullable()->after('contract_duration_months');
            $table->date('contract_end_date')->nullable()->after('contract_start_date');
            $table->string('contract_status', 30)->default('active')->after('contract_end_date'); // active, expiring_soon, expired, renewal_requested, renewed
            $table->timestamp('renewal_requested_at')->nullable()->after('contract_status');
            $table->text('renewal_notes')->nullable()->after('renewal_requested_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn([
                'contract_duration_months',
                'contract_start_date',
                'contract_end_date',
                'contract_status',
                'renewal_requested_at',
                'renewal_notes',
            ]);
        });
    }
};
