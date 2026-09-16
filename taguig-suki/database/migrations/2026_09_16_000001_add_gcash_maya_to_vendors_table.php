<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('gcash_number')->nullable()->after('stall_location');
            $table->string('gcash_qr_path')->nullable()->after('gcash_number');
            $table->string('maya_number')->nullable()->after('gcash_qr_path');
            $table->string('maya_qr_path')->nullable()->after('maya_number');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['gcash_number', 'gcash_qr_path', 'maya_number', 'maya_qr_path']);
        });
    }
};
