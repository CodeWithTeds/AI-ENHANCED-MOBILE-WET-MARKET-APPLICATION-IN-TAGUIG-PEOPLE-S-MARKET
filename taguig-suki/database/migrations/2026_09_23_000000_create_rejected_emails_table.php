<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rejected_emails', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('reason');
            $table->string('rejected_by_type')->comment('user or vendor');
            $table->unsignedBigInteger('rejected_by_admin_id')->nullable();
            $table->timestamps();

            $table->foreign('rejected_by_admin_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rejected_emails');
    }
};
