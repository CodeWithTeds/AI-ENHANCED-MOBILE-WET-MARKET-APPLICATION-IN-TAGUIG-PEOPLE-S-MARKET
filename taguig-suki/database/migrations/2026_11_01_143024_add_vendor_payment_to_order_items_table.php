<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Each vendor portion tracks its own payment status, reference number, and verification.
     */
    public function up(): void
    {
        // 1. Allow 'partially_paid' in orders table payment_status
        try {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE orders MODIFY payment_status ENUM('unpaid', 'pending_verification', 'partially_paid', 'paid', 'rejected') DEFAULT 'unpaid'");
            }
        } catch (\Throwable $e) {
            // Ignore if driver doesn't support or already string
        }

        // 2. Add payment fields to order_items for vendor-portion payment granularity
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'payment_status')) {
                $table->string('payment_status')->default('unpaid')->after('confirmation_status');
            }
            if (!Schema::hasColumn('order_items', 'payment_reference_number')) {
                $table->string('payment_reference_number')->nullable()->after('payment_status');
            }
            if (!Schema::hasColumn('order_items', 'payment_submitted_at')) {
                $table->timestamp('payment_submitted_at')->nullable()->after('payment_reference_number');
            }
            if (!Schema::hasColumn('order_items', 'payment_verified_at')) {
                $table->timestamp('payment_verified_at')->nullable()->after('payment_submitted_at');
            }
            if (!Schema::hasColumn('order_items', 'payment_verified_by')) {
                $table->foreignId('payment_verified_by')->nullable()->after('payment_verified_at')->constrained('users')->nullOnDelete();
            }
        });

        // 3. Backfill existing items: inherit their parent order's payment details
        DB::table('orders')->select('id', 'payment_status', 'payment_reference_number', 'payment_submitted_at', 'payment_verified_at', 'payment_verified_by')
            ->orderBy('id')
            ->chunk(500, function ($orders) {
                foreach ($orders as $order) {
                    DB::table('order_items')->where('order_id', $order->id)->update([
                        'payment_status' => $order->payment_status ?? 'unpaid',
                        'payment_reference_number' => $order->payment_reference_number,
                        'payment_submitted_at' => $order->payment_submitted_at,
                        'payment_verified_at' => $order->payment_verified_at,
                        'payment_verified_by' => $order->payment_verified_by,
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['payment_verified_by']);
            $table->dropColumn([
                'payment_status',
                'payment_reference_number',
                'payment_submitted_at',
                'payment_verified_at',
                'payment_verified_by',
            ]);
        });
    }
};
