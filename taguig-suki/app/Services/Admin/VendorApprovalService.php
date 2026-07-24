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
