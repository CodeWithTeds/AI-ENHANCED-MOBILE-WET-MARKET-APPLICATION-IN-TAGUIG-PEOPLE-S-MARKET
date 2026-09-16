<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Convert any existing 'processing' orders to 'ready' to avoid data loss when removing enum value
        if (Schema::hasTable('orders')) {
            try {
                DB::table('orders')->where('status', 'processing')->update(['status' => 'ready']);
                DB::table('order_status_histories')->where('status', 'processing')->update(['status' => 'ready']);
            } catch (\Throwable $e) {
                // ignore if tables not yet migrated
            }

            // Alter enum to remove 'processing' (MySQL specific)
            try {
                $driver = Schema::getConnection()->getDriverName();
                if ($driver === 'mysql') {
                    DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','confirmed','ready','completed','cancelled') DEFAULT 'pending'");
                }
            } catch (\Throwable $e) {
                // Fallback: ignore if already compatible or using sqlite
            }
        }
    }

    public function down(): void
    {
        try {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql' && Schema::hasTable('orders')) {
                DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','confirmed','processing','ready','completed','cancelled') DEFAULT 'pending'");
            }
        } catch (\Throwable $e) {
            //
        }
    }
};
