<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('confirmation_expires_at')->nullable()->after('confirmed_by');
            $table->timestamp('ready_at')->nullable()->after('confirmation_expires_at');
            $table->timestamp('pickup_expires_at')->nullable()->after('ready_at');
            $table->timestamp('cancelled_at')->nullable()->after('pickup_expires_at');
            $table->string('cancelled_by', 32)->nullable()->after('cancelled_at');
            $table->text('cancellation_reason')->nullable()->after('cancelled_by');

            $table->index(['status', 'confirmation_expires_at']);
            $table->index(['status', 'pickup_expires_at']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->timestamp('vendor_confirmed_at')->nullable()->after('confirmation_status');
            $table->timestamp('ready_at')->nullable()->after('vendor_confirmed_at');
            $table->timestamp('pickup_expires_at')->nullable()->after('ready_at');
            $table->timestamp('cancelled_at')->nullable()->after('pickup_expires_at');
            $table->string('cancelled_by', 32)->nullable()->after('cancelled_at');
            $table->text('cancellation_reason')->nullable()->after('cancelled_by');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn([
                'vendor_confirmed_at',
                'ready_at',
                'pickup_expires_at',
                'cancelled_at',
                'cancelled_by',
                'cancellation_reason',
            ]);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status', 'confirmation_expires_at']);
            $table->dropIndex(['status', 'pickup_expires_at']);
            $table->dropColumn([
                'confirmation_expires_at',
                'ready_at',
                'pickup_expires_at',
                'cancelled_at',
                'cancelled_by',
                'cancellation_reason',
            ]);
        });
    }
};
