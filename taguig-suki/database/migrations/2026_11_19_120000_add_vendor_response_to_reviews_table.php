<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->text('vendor_response')->nullable()->after('admin_response');
            $table->timestamp('vendor_responded_at')->nullable()->after('resolved_at');
            $table->boolean('needs_response')->default(false)->after('vendor_response');
        });

        // Retroactively classify existing reviews:
        // 1. Ratings without comments do NOT need response and are auto-resolved.
        DB::table('reviews')
            ->where(function ($q) {
                $q->whereNull('comment')->orWhere(DB::raw("TRIM(comment)"), '');
            })
            ->update([
                'needs_response' => false,
                'status' => 'resolved',
                'resolved_at' => DB::raw('COALESCE(resolved_at, created_at)'),
            ]);

        // 2. Reviews with written comments that have not yet been resolved or dismissed need response.
        DB::table('reviews')
            ->whereNotNull('comment')
            ->where(DB::raw("TRIM(comment)"), '!=', '')
            ->whereIn('status', ['pending', 'in_review'])
            ->whereNull('admin_response')
            ->whereNull('vendor_response')
            ->update([
                'needs_response' => true,
            ]);
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropColumn(['vendor_response', 'vendor_responded_at', 'needs_response']);
        });
    }
};
