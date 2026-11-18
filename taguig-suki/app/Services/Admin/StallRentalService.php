<?php

namespace App\Services\Admin;

use App\Models\Notification;
use App\Models\Stall;
use App\Models\StallRentalPayment;
use App\Models\User;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class StallRentalService
{
    /**
     * Get index data for the admin rental payment monitoring dashboard.
     */
    public function getRentalsIndexData(array $filters): array
    {
        // Update overdue status on unpaid records whose due date has passed
        StallRentalPayment::where('status', 'unpaid')
            ->where('due_date', '<', now()->toDateString())
            ->update(['status' => 'overdue']);

        $query = StallRentalPayment::query()->with([
            'vendor:id,user_id,stall_name,stall_location',
            'stall:id,stall_number,store_name,section,monthly_rent',
            'verifier:id,name',
        ]);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['billing_period'])) {
            $query->where('billing_period', $filters['billing_period']);
        }

        if (!empty($filters['vendor_id'])) {
            $query->where('vendor_id', $filters['vendor_id']);
        }

        if (!empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('payment_reference', 'like', "%{$s}%")
                  ->orWhereHas('vendor', fn ($vq) => $vq->where('stall_name', 'like', "%{$s}%"))
                  ->orWhereHas('stall', fn ($sq) => $sq->where('stall_number', 'like', "%{$s}%"));
            });
        }

        $rentals = $query->orderByDesc('due_date')->paginate(15)->withQueryString();

        $stats = [
            'total' => StallRentalPayment::count(),
            'paid' => StallRentalPayment::where('status', 'paid')->count(),
            'unpaid' => StallRentalPayment::where('status', 'unpaid')->count(),
            'pending' => StallRentalPayment::where('status', 'pending')->count(),
            'overdue' => StallRentalPayment::where('status', 'overdue')->count(),
            'total_collected' => (float) StallRentalPayment::where('status', 'paid')->sum('amount'),
            'total_receivable' => (float) StallRentalPayment::whereIn('status', ['unpaid', 'overdue', 'pending'])->sum('amount'),
        ];

        $vendors = Vendor::where('status', 'approved')->get(['id', 'stall_name', 'stall_location']);

        return [
            'rentals' => $rentals,
            'stats' => $stats,
            'filters' => $filters,
            'vendors' => $vendors,
            'statuses' => [
                ['value' => 'paid', 'label' => 'Paid'],
                ['value' => 'unpaid', 'label' => 'Unpaid'],
                ['value' => 'pending', 'label' => 'Pending Verification'],
                ['value' => 'overdue', 'label' => 'Overdue'],
            ],
        ];
    }

    /**
     * Generate monthly rental billing for all occupied stalls (or a single vendor) for a given period (e.g. '2026-11').
     */
    public function generateMonthlyBills(string $billingPeriod, ?Carbon $dueDate = null, ?int $vendorId = null): int
    {
        $due = $dueDate ?: Carbon::createFromFormat('Y-m', $billingPeriod)->startOfMonth()->addDays(14); // 15th of the month

        $query = Stall::query();

        if ($vendorId) {
            $query->where(function ($q) use ($vendorId) {
                $q->where('vendor_id', $vendorId)
                  ->orWhereHas('vendor', fn ($vq) => $vq->where('id', $vendorId)->orWhere('user_id', $vendorId));
            });
        } else {
            $query->where('status', 'occupied')->whereNotNull('vendor_id');
        }

        $occupiedStalls = $query->get();

        // Fallback for single vendor selection if stall status/vendor_id hasn't linked yet
        if ($vendorId && $occupiedStalls->isEmpty()) {
            $vendor = Vendor::find($vendorId);
            if ($vendor && $vendor->stall_id) {
                $stall = Stall::find($vendor->stall_id);
                if ($stall) {
                    $occupiedStalls = collect([$stall]);
                }
            }
        }

        $count = 0;
        foreach ($occupiedStalls as $stall) {
            $vendor = Vendor::where('user_id', $stall->vendor_id)->orWhere('id', $stall->vendor_id)->first();
            if (!$vendor && $vendorId) {
                $vendor = Vendor::find($vendorId);
            }
            if (!$vendor) continue;

            $exists = StallRentalPayment::where('stall_id', $stall->id)
                ->where('billing_period', $billingPeriod)
                ->exists();

            if (!$exists) {
                $rental = StallRentalPayment::create([
                    'vendor_id' => $vendor->id,
                    'stall_id' => $stall->id,
                    'billing_period' => $billingPeriod,
                    'amount' => $stall->monthly_rent ?: 3500.00,
                    'due_date' => $due->toDateString(),
                    'status' => 'unpaid',
                ]);
                $this->notifyRentalGenerated($rental);
                $count++;
            }
        }

        return $count;
    }

    /**
     * Record or submit a rental payment.
     */
    public function recordPayment(
        StallRentalPayment $rental,
        string $paymentMethod,
        ?string $reference = null,
        ?UploadedFile $proof = null,
        bool $autoVerify = false,
        ?User $admin = null
    ): StallRentalPayment {
        $proofPath = $proof ? $proof->store("rentals/{$rental->id}", 'public') : $rental->proof_path;

        $rental->update([
            'payment_method' => $paymentMethod,
            'payment_reference' => $reference,
            'proof_path' => $proofPath,
            'paid_at' => now(),
            'status' => $autoVerify ? 'paid' : 'pending',
            'verified_by' => $autoVerify && $admin ? $admin->id : null,
        ]);

        return $rental->fresh(['vendor', 'stall']);
    }

    /**
     * Admin verifies rental payment.
     */
    public function verifyPayment(StallRentalPayment $rental, User $admin): StallRentalPayment
    {
        $rental->update([
            'status' => 'paid',
            'verified_by' => $admin->id,
        ]);

        $this->notifyPaymentVerified($rental);

        return $rental->fresh(['vendor', 'stall', 'verifier']);
    }

    /**
     * Get rental reports showing vendor rental records, payments, and document requirements.
     */
    public function getRentalReportData(array $filters = []): array
    {
        $vendors = Vendor::where('status', 'approved')
            ->with(['user', 'documents', 'rentalPayments' => fn ($q) => $q->orderByDesc('billing_period')])
            ->get()
            ->map(function (Vendor $vendor) {
                $payments = $vendor->rentalPayments;
                $docTypes = $vendor->documents->pluck('document_type')->all();

                $requirements = [
                    'valid_id' => in_array('valid_id', $docTypes, true),
                    'business_permit' => in_array('business_permit', $docTypes, true),
                    'sanitary_permit' => in_array('sanitary_permit', $docTypes, true),
                    'dti_registration' => in_array('dti_registration', $docTypes, true),
                ];

                $allRequirementsMet = !in_array(false, $requirements, true);

                $totalPaid = $payments->where('status', 'paid')->sum('amount');
                $totalOverdue = $payments->where('status', 'overdue')->sum('amount');
                $latestPayment = $payments->first();

                return [
                    'vendor_id' => $vendor->id,
                    'stall_name' => $vendor->stall_name,
                    'stall_location' => $vendor->stall_location,
                    'contract_start' => $vendor->contract_start_date,
                    'contract_end' => $vendor->contract_end_date,
                    'contract_status' => $vendor->contract_status,
                    'requirements' => $requirements,
                    'requirements_complete' => $allRequirementsMet,
                    'total_paid' => (float) $totalPaid,
                    'total_overdue' => (float) $totalOverdue,
                    'current_status' => $totalOverdue > 0 ? 'Overdue' : ($latestPayment?->status === 'paid' ? 'Up to date' : 'Pending/Unpaid'),
                    'latest_billing_period' => $latestPayment?->billing_period,
                    'payments_history' => $payments->take(6)->values(),
                ];
            });

        return [
            'vendor_reports' => $vendors,
            'summary' => [
                'total_vendors' => $vendors->count(),
                'compliant_requirements' => $vendors->where('requirements_complete', true)->count(),
                'up_to_date_rent' => $vendors->where('current_status', 'Up to date')->count(),
                'overdue_rent' => $vendors->where('current_status', 'Overdue')->count(),
                'total_rent_collected' => $vendors->sum('total_paid'),
                'total_rent_overdue' => $vendors->sum('total_overdue'),
            ],
        ];
    }

    private function notifyRentalGenerated(StallRentalPayment $rental): void
    {
        $vendor = $rental->vendor;
        if ($vendor && $vendor->user_id) {
            Notification::create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\RentalDueNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $vendor->user_id,
                'data' => json_encode([
                    'title' => "Monthly Stall Rent Due ({$rental->billing_period})",
                    'message' => "Stall rent of ₱{$rental->amount} for {$rental->billing_period} is due on {$rental->due_date}. Please submit payment promptly.",
                    'rental_id' => $rental->id,
                    'due_date' => $rental->due_date,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function notifyPaymentVerified(StallRentalPayment $rental): void
    {
        $vendor = $rental->vendor;
        if ($vendor && $vendor->user_id) {
            Notification::create([
                'id' => (string) Str::uuid(),
                'type' => 'App\Notifications\RentalPaymentVerifiedNotification',
                'notifiable_type' => 'App\Models\User',
                'notifiable_id' => $vendor->user_id,
                'data' => json_encode([
                    'title' => "Stall Rental Payment Verified ({$rental->billing_period})",
                    'message' => "Your stall rent payment of ₱{$rental->amount} has been verified and marked Paid.",
                    'rental_id' => $rental->id,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
