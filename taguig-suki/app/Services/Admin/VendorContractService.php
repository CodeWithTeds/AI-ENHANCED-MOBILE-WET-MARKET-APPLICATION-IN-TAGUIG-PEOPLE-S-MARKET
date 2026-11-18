<?php

namespace App\Services\Admin;

use App\Models\Notification;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class VendorContractService
{
    /**
     * Initialize or update a vendor's contract upon approval or creation.
     */
    public function setupContract(Vendor $vendor, int $durationMonths = 12, ?Carbon $startDate = null): Vendor
    {
        $start = $startDate ?: now();
        $end = $start->copy()->addMonths($durationMonths);

        $vendor->update([
            'contract_duration_months' => $durationMonths,
            'contract_start_date' => $start->toDateString(),
            'contract_end_date' => $end->toDateString(),
            'contract_status' => 'active',
        ]);

        return $vendor;
    }

    /**
     * Check contract statuses, flagging expiring_soon (within 30 days) and expired.
     * Generates notifications for vendors and admins when status changes.
     */
    public function checkExpiringContracts(): array
    {
        $today = now()->startOfDay();
        $thirtyDays = $today->copy()->addDays(30);

        $expiring = Vendor::where('status', 'approved')
            ->whereNotNull('contract_end_date')
            ->where('contract_end_date', '>=', $today->toDateString())
            ->where('contract_end_date', '<=', $thirtyDays->toDateString())
            ->where('contract_status', 'active')
            ->get();

        foreach ($expiring as $vendor) {
            $vendor->update(['contract_status' => 'expiring_soon']);
            $this->notifyContractExpiring($vendor);
        }

        $expired = Vendor::where('status', 'approved')
            ->whereNotNull('contract_end_date')
            ->where('contract_end_date', '<', $today->toDateString())
            ->whereIn('contract_status', ['active', 'expiring_soon'])
            ->get();

        foreach ($expired as $vendor) {
            $vendor->update(['contract_status' => 'expired']);
            $this->notifyContractExpired($vendor);
        }

        return [
            'expiring_soon_count' => $expiring->count(),
            'expired_count' => $expired->count(),
        ];
    }

    /**
     * Vendor submits a renewal request.
     */
    public function requestRenewal(Vendor $vendor, ?string $notes = null): Vendor
    {
        $vendor->update([
            'contract_status' => 'renewal_requested',
            'renewal_requested_at' => now(),
            'renewal_notes' => $notes,
        ]);

        $this->notifyAdminRenewalRequested($vendor);

        return $vendor;
    }

    /**
     * Admin approves renewal, extending contract.
     */
    public function approveRenewal(Vendor $vendor, int $additionalMonths = 12): Vendor
    {
        $currentEnd = $vendor->contract_end_date ? Carbon::parse($vendor->contract_end_date) : now();
        $base = $currentEnd->isPast() ? now() : $currentEnd;
        $newEnd = $base->copy()->addMonths($additionalMonths);

        $vendor->update([
            'contract_duration_months' => $vendor->contract_duration_months + $additionalMonths,
            'contract_end_date' => $newEnd->toDateString(),
            'contract_status' => 'active',
            'renewal_notes' => null,
        ]);

        $this->notifyVendorRenewalApproved($vendor, $newEnd);

        return $vendor;
    }

    private function notifyContractExpiring(Vendor $vendor): void
    {
        if ($vendor->user_id) {
            Notification::create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\ContractExpiringNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $vendor->user_id,
                'data' => json_encode([
                    'title' => 'Stall Contract Expiring Soon',
                    'message' => "Your stall lease contract for {$vendor->stall_name} expires on {$vendor->contract_end_date}. You can request renewal now in your vendor settings.",
                    'contract_end_date' => $vendor->contract_end_date,
                    'vendor_id' => $vendor->id,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function notifyContractExpired(Vendor $vendor): void
    {
        if ($vendor->user_id) {
            Notification::create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\ContractExpiredNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $vendor->user_id,
                'data' => json_encode([
                    'title' => 'Stall Contract Expired',
                    'message' => "Your stall lease contract for {$vendor->stall_name} expired on {$vendor->contract_end_date}. Please submit a renewal request or contact the market office.",
                    'contract_end_date' => $vendor->contract_end_date,
                    'vendor_id' => $vendor->id,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function notifyAdminRenewalRequested(Vendor $vendor): void
    {
        // Admin notifications or logging
    }

    private function notifyVendorRenewalApproved(Vendor $vendor, Carbon $newEnd): void
    {
        if ($vendor->user_id) {
            Notification::create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\ContractRenewedNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $vendor->user_id,
                'data' => json_encode([
                    'title' => 'Stall Contract Renewed!',
                    'message' => "Your lease contract for {$vendor->stall_name} has been renewed until {$newEnd->toDateString()}.",
                    'contract_end_date' => $newEnd->toDateString(),
                    'vendor_id' => $vendor->id,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
