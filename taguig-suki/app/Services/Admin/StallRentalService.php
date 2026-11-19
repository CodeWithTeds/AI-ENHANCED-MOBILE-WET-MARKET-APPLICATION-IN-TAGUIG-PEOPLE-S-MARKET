<?php

namespace App\Services\Admin;

use App\Enums\StallStatus;
use App\Models\Notification;
use App\Models\Stall;
use App\Models\StallRentalPayment;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorContractRequest;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class StallRentalService
{
    protected NotificationService $notificationService;

    public function __construct(?NotificationService $notificationService = null)
    {
        $this->notificationService = $notificationService ?: app(NotificationService::class);
    }
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
    public function generateMonthlyBills(
        string $billingPeriod,
        ?Carbon $dueDate = null,
        ?int $vendorId = null,
        ?float $customAmount = null
    ): int {
        $due = $dueDate ?: Carbon::createFromFormat('Y-m', $billingPeriod)->startOfMonth()->addDays(14); // 15th of the month

        $targets = collect();

        if ($vendorId) {
            $vendor = Vendor::with('stall')->find($vendorId);
            if ($vendor) {
                $stall = Stall::where('vendor_id', $vendor->user_id)->first();
                if (!$stall && $vendor->stall_id) {
                    $stall = Stall::find($vendor->stall_id);
                }
                if (!$stall) {
                    $stall = Stall::where('vendor_id', $vendor->id)->first();
                }
                if ($stall) {
                    $targets->push(['stall' => $stall, 'vendor' => $vendor]);
                }
            }
        } else {
            $occupiedStalls = Stall::where('status', 'occupied')->whereNotNull('vendor_id')->get();
            foreach ($occupiedStalls as $stall) {
                $vendor = Vendor::where('user_id', $stall->vendor_id)->orWhere('id', $stall->vendor_id)->first();
                if ($vendor) {
                    $targets->push(['stall' => $stall, 'vendor' => $vendor]);
                }
            }

            // Also check approved vendors that have an assigned occupied stall
            $approvedVendors = Vendor::where('status', 'approved')->whereNotNull('user_id')->get();
            foreach ($approvedVendors as $vendor) {
                if ($targets->contains(fn ($t) => $t['vendor']->id === $vendor->id)) {
                    continue;
                }
                $stall = Stall::where('vendor_id', $vendor->user_id)->first();
                if (!$stall && $vendor->stall_id) {
                    $stall = Stall::find($vendor->stall_id);
                }
                $isOccupied = $stall && ($stall->status instanceof StallStatus ? $stall->status === StallStatus::Occupied : $stall->status === 'occupied');
                if ($stall && $isOccupied) {
                    $targets->push(['stall' => $stall, 'vendor' => $vendor]);
                }
            }
        }

        $count = 0;
        foreach ($targets as $pair) {
            $stall = $pair['stall'];
            $vendor = $pair['vendor'];

            $exists = StallRentalPayment::where('stall_id', $stall->id)
                ->where('billing_period', $billingPeriod)
                ->exists();

            if (!$exists) {
                $amount = $customAmount ?: ($stall->monthly_rent ?: 3500.00);
                $rental = StallRentalPayment::create([
                    'vendor_id' => $vendor->id,
                    'stall_id' => $stall->id,
                    'billing_period' => $billingPeriod,
                    'amount' => $amount,
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
     * Admin updates stall rental payment status (e.g. paid, unpaid, pending, overdue).
     */
    public function updatePaymentStatus(
        StallRentalPayment $rental,
        string $status,
        array $attributes = [],
        ?User $admin = null
    ): StallRentalPayment {
        $previousStatus = $rental->status;
        $updates = ['status' => $status];

        if ($status === 'paid') {
            $updates['paid_at'] = !empty($attributes['paid_at'])
                ? Carbon::parse($attributes['paid_at'])
                : ($rental->paid_at ?: now());
            $updates['payment_method'] = $attributes['payment_method'] ?? ($rental->payment_method ?: 'cash');
            if (isset($attributes['payment_reference'])) {
                $updates['payment_reference'] = $attributes['payment_reference'];
            }
            if ($admin) {
                $updates['verified_by'] = $admin->id;
            }
        } elseif ($status === 'unpaid') {
            $updates['paid_at'] = null;
            $updates['verified_by'] = null;
            if (isset($attributes['payment_reference'])) {
                $updates['payment_reference'] = $attributes['payment_reference'];
            }
        } elseif ($status === 'pending') {
            $updates['verified_by'] = null;
            if (!empty($attributes['payment_method'])) {
                $updates['payment_method'] = $attributes['payment_method'];
            }
            if (isset($attributes['payment_reference'])) {
                $updates['payment_reference'] = $attributes['payment_reference'];
            }
        } elseif ($status === 'overdue') {
            $updates['paid_at'] = null;
            $updates['verified_by'] = null;
        }

        if (array_key_exists('notes', $attributes)) {
            $updates['notes'] = $attributes['notes'];
        }

        $rental->update($updates);
        $fresh = $rental->fresh(['vendor', 'stall', 'verifier']);

        $this->notifyPaymentStatusUpdated($fresh, $previousStatus, $admin);

        return $fresh;
    }

    /**
     * Admin verifies rental payment.
     */
    public function verifyPayment(StallRentalPayment $rental, User $admin): StallRentalPayment
    {
        return $this->updatePaymentStatus($rental, 'paid', [
            'payment_method' => $rental->payment_method ?: 'cash',
            'paid_at' => $rental->paid_at ?: now(),
        ], $admin);
    }

    /**
     * Get rental reports showing vendor rental records, payments, and document requirements.
     * Excludes unoccupied (vacant, under maintenance, or unassigned) stalls.
     */
    public function getRentalReportData(array $filters = []): array
    {
        $vendors = Vendor::where('status', 'approved')
            ->whereHas('stall', function ($q) {
                $q->where('status', StallStatus::Occupied->value);
            })
            ->with([
                'user',
                'stall',
                'documents',
                'rentalPayments' => fn ($q) => $q->orderByDesc('billing_period'),
            ])
            ->get()
            ->map(function (Vendor $vendor) {
                $stall = $vendor->stall;
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

                $stallLocation = $stall
                    ? "{$stall->stall_number}, " . ucfirst(str_replace('-', ' ', $stall->section ?? ''))
                    : $vendor->stall_location;

                return [
                    'vendor_id' => $vendor->id,
                    'stall_id' => $stall?->id,
                    'stall_number' => $stall?->stall_number,
                    'stall_name' => $stall?->store_name ?: $vendor->stall_name,
                    'stall_location' => $stallLocation,
                    'stall_status' => $stall?->status instanceof \BackedEnum ? $stall->status->value : ($stall?->status ?? 'occupied'),
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

        $contractRequests = VendorContractRequest::with(['vendor.stall', 'reviewer'])
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(function (VendorContractRequest $req) {
                $vendor = $req->vendor;
                $stall = $vendor?->stall;
                $stallLocation = $stall
                    ? "{$stall->stall_number}, " . ucfirst(str_replace('-', ' ', $stall->section ?? ''))
                    : $vendor?->stall_location;

                return [
                    'id' => $req->id,
                    'vendor_id' => $req->vendor_id,
                    'vendor_name' => $vendor?->user?->name ?? $vendor?->stall_name,
                    'stall_name' => $stall?->store_name ?: $vendor?->stall_name,
                    'stall_number' => $stall?->stall_number,
                    'stall_location' => $stallLocation,
                    'type' => $req->type, // 'renewal' or 'cancellation'
                    'requested_duration_months' => $req->requested_duration_months,
                    'status' => $req->status, // 'pending', 'approved', 'rejected'
                    'reason' => $req->reason,
                    'admin_notes' => $req->admin_notes,
                    'reviewer_name' => $req->reviewer?->name,
                    'reviewed_at' => $req->reviewed_at?->format('M d, Y g:i A'),
                    'created_at' => $req->created_at->format('M d, Y g:i A'),
                    'contract_start' => $vendor?->contract_start_date,
                    'contract_end' => $vendor?->contract_end_date,
                    'contract_status' => $vendor?->contract_status,
                ];
            });

        return [
            'vendor_reports' => $vendors,
            'contract_requests' => $contractRequests,
            'summary' => [
                'total_vendors' => $vendors->count(),
                'occupied_stalls' => $vendors->count(),
                'compliant_requirements' => $vendors->where('requirements_complete', true)->count(),
                'up_to_date_rent' => $vendors->where('current_status', 'Up to date')->count(),
                'overdue_rent' => $vendors->where('current_status', 'Overdue')->count(),
                'total_rent_collected' => $vendors->sum('total_paid'),
                'total_rent_overdue' => $vendors->sum('total_overdue'),
                'pending_requests_count' => $contractRequests->where('status', 'pending')->count(),
                'pending_renewals_count' => $contractRequests->where('status', 'pending')->where('type', 'renewal')->count(),
                'pending_cancellations_count' => $contractRequests->where('status', 'pending')->where('type', 'cancellation')->count(),
            ],
        ];
    }

    private function notifyRentalGenerated(StallRentalPayment $rental): void
    {
        $this->notificationService->notifyVendorRentalBillGenerated($rental);
    }

    private function notifyPaymentStatusUpdated(StallRentalPayment $rental, string $previousStatus = 'unpaid', ?User $admin = null): void
    {
        $this->notificationService->notifyVendorRentalPaymentStatusUpdated($rental, $previousStatus, $admin);
    }

    private function notifyPaymentVerified(StallRentalPayment $rental): void
    {
        $this->notifyPaymentStatusUpdated($rental, 'pending');
    }
}
