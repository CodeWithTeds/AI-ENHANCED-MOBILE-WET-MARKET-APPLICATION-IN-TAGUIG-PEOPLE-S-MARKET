<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stalls', function (Blueprint $table) {
            $table->id();
            $table->string('section'); // meat, fish, dry_ingredients
            $table->string('stall_number');
            $table->string('store_name');
            $table->foreignId('vendor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('vacant'); // occupied, vacant, under_maintenance
            $table->string('size')->default('medium'); // small, medium, large
            $table->decimal('monthly_rent', 10, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('image')->nullable();
            $table->timestamps();

            $table->unique(['section', 'stall_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stalls');
    }
};
