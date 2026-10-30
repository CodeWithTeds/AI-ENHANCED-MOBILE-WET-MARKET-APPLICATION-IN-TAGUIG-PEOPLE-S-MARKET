<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add confirmation status and timestamp columns to orders table
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'confirmation_status')) {
                $table->string('confirmation_status')->default('not_required')->after('status');
            }
            if (!Schema::hasColumn('orders', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('confirmation_status');
            }
            if (!Schema::hasColumn('orders', 'confirmed_by')) {
                $table->foreignId('confirmed_by')->nullable()->after('confirmed_at')->constrained('users')->nullOnDelete();
            }
        });

        // Ensure status column in orders allows 'pending_confirmation' if MySQL
        try {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','pending_confirmation','confirmed','ready','completed','cancelled') DEFAULT 'pending'");
            }
        } catch (\Throwable $e) {
            // Keep existing driver behavior
        }

        // 2. Add confirmation status to order_items table for vendor-portion granularity
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'confirmation_status')) {
                $table->string('confirmation_status')->default('not_required')->after('status');
            }
        });

        // 3. Create order_conversations table
        Schema::create('order_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->string('confirmation_status')->default('none'); // none, pending_confirmation, confirmed, cancelled
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'vendor_id', 'customer_id'], 'order_vendor_customer_unique');
            $table->index(['customer_id', 'created_at']);
            $table->index(['vendor_id', 'created_at']);
        });

        // 4. Create order_messages table
        Schema::create('order_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_conversation_id')->constrained('order_conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->string('sender_type'); // 'customer', 'vendor', 'system'
            $table->text('message');
            $table->string('message_type')->default('text'); // 'text', 'confirmation_request', 'order_confirmed', 'order_cancelled', 'order_clarification'
            $table->json('metadata')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['order_conversation_id', 'created_at']);
            $table->index(['sender_id', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_messages');
        Schema::dropIfExists('order_conversations');

        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'confirmation_status')) {
                $table->dropColumn('confirmation_status');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'confirmed_by')) {
                $table->dropForeign(['confirmed_by']);
                $table->dropColumn('confirmed_by');
            }
            if (Schema::hasColumn('orders', 'confirmed_at')) {
                $table->dropColumn('confirmed_at');
            }
            if (Schema::hasColumn('orders', 'confirmation_status')) {
                $table->dropColumn('confirmation_status');
            }
        });

        try {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE orders MODIFY status ENUM('pending','confirmed','ready','completed','cancelled') DEFAULT 'pending'");
            }
        } catch (\Throwable $e) {
            //
        }
    }
};
