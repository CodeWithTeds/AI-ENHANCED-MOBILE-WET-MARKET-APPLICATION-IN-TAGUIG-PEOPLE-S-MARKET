<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        // order_items.quantity: integer → decimal(10,2) to allow 0.5 kg
        if (Schema::hasTable('order_items') && $driver === 'mysql') {
            DB::statement('ALTER TABLE order_items MODIFY quantity DECIMAL(10,2) NOT NULL');
        }

        // inventories: stock_quantity, reorder_level, max_stock_level → decimal for half-kilo stock
        if (Schema::hasTable('inventories') && $driver === 'mysql') {
            DB::statement('ALTER TABLE inventories MODIFY stock_quantity DECIMAL(10,2) NOT NULL DEFAULT 0');
            DB::statement('ALTER TABLE inventories MODIFY reorder_level DECIMAL(10,2) NOT NULL DEFAULT 5');
            DB::statement('ALTER TABLE inventories MODIFY max_stock_level DECIMAL(10,2) NULL');
        }

        // inventory_logs: allow fractional movements (0.5 kg sold/restocked)
        if (Schema::hasTable('inventory_logs') && $driver === 'mysql') {
            DB::statement('ALTER TABLE inventory_logs MODIFY quantity_before DECIMAL(10,2) NOT NULL');
            DB::statement('ALTER TABLE inventory_logs MODIFY quantity_change DECIMAL(10,2) NOT NULL');
            DB::statement('ALTER TABLE inventory_logs MODIFY quantity_after DECIMAL(10,2) NOT NULL');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            if (Schema::hasTable('order_items')) {
                DB::statement('ALTER TABLE order_items MODIFY quantity INT NOT NULL');
            }
            if (Schema::hasTable('inventories')) {
                DB::statement('ALTER TABLE inventories MODIFY stock_quantity INT NOT NULL DEFAULT 0');
                DB::statement('ALTER TABLE inventories MODIFY reorder_level INT NOT NULL DEFAULT 5');
                DB::statement('ALTER TABLE inventories MODIFY max_stock_level INT NULL');
            }
            if (Schema::hasTable('inventory_logs')) {
                DB::statement('ALTER TABLE inventory_logs MODIFY quantity_before INT NOT NULL');
                DB::statement('ALTER TABLE inventory_logs MODIFY quantity_change INT NOT NULL');
                DB::statement('ALTER TABLE inventory_logs MODIFY quantity_after INT NOT NULL');
            }
        }
    }
};
