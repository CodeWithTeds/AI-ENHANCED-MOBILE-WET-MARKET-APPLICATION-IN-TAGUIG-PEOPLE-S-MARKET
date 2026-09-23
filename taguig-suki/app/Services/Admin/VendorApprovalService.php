<?php

namespace App\Services\Admin;

use App\Enums\VendorStatus;
use App\Models\Vendor;

class VendorApprovalService
{
    public function getPendingData(): array
    {
        return [
            'vendors' => Vendor::with(['user', 'documents'])->where('status', VendorStatus::Pending->value)->orderByDesc('created_at')->paginate(15),
            'stats' => $this->getStats(),
        ];
    }

    public function getDocumentsData(?string $status): array
    {
        $query = Vendor::with(['user', 'documents']);

        if ($status) {
            $query->where('status', $status);
        }

        return [
            'vendors' => $query->orderByDesc('created_at')->paginate(15),
            'stats' => $this->getStats(),
            'filters' => ['status' => $status],
        ];
    }

    public function approve(Vendor $vendor): Vendor
    {
        $vendor->update([
            'status' => VendorStatus::Approved->value,
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        return $vendor;
    }

    public function reject(Vendor $vendor, string $reason): Vendor
    {
        $vendor->update([
            'status' => VendorStatus::Rejected->value,
            'rejection_reason' => $reason,
        ]);

        // Block the vendor's email from future registration and notify them
        $user = $vendor->user;
        if ($user) {
            // Send rejection notification
            try {
                $user->notify(new \App\Notifications\RegistrationRejectedNotification($reason, 'vendor'));
            } catch (\Throwable) {
                // If mail fails, still proceed with rejection
            }

            // Block the email from future registration
            \App\Models\RejectedEmail::updateOrCreate(
                ['email' => strtolower($user->email)],
                [
                    'reason' => $reason,
                    'rejected_by_type' => 'vendor',
                    'rejected_by_admin_id' => auth()->id(),
                ]
            );
        }

        return $vendor;
    }

    private function getStats(): array
    {
        return [
            'pending' => Vendor::where('status', VendorStatus::Pending->value)->count(),
            'approved' => Vendor::where('status', VendorStatus::Approved->value)->count(),
            'rejected' => Vendor::where('status', VendorStatus::Rejected->value)->count(),
            'total' => Vendor::count(),
        ];
    }
}
