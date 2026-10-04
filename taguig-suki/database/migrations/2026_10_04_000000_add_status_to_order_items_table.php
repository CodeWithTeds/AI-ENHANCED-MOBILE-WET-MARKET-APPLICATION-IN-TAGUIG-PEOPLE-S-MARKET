<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each vendor manages only their own portion of an order, so every
     * order item tracks its own fulfillment status. The order-level status
     * is derived from its portions (see OrderService::refreshOverallStatus).
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('status')->default('pending')->after('subtotal');
        });

        // Backfill: existing portions inherit their order's status.
        // Chunked loop keeps this portable across MySQL and SQLite.
        DB::table('orders')->select('id', 'status')->orderBy('id')->chunk(500, function ($orders) {
            foreach ($orders as $order) {
                DB::table('order_items')->where('order_id', $order->id)->update(['status' => $order->status]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
