<?php

namespace App\Services\Admin;

use App\Enums\StallStatus;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorContractRequest;
use App\Notifications\ContractExpiredNotification;
use App\Notifications\ContractExpiringNotification;
use App\Notifications\ContractRequestReviewedNotification;
use Carbon\Carbon;
use InvalidArgumentException;

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
     * Generates automatic notifications for vendors when status changes.
     */
    public function checkExpiringContracts(): array
    {
        $today = now()->startOfDay();
        $thirtyDays = $today->copy()->addDays(30);

        // Active contracts expiring within the next 30 days
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

        // Contracts that have passed their expiration date
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
     * Vendor initiates either Contract Renewal (1, 3, 6, 12 months) or Contract Cancellation.
     * Contracts must NOT be automatically renewed or cancelled; they are submitted as pending requests.
     */
    public function submitContractRequest(
        Vendor $vendor,
        string $type,
        ?int $durationMonths = null,
        ?string $reason = null
    ): VendorContractRequest {
        $normalizedType = strtolower(trim($type));
        if (!in_array($normalizedType, ['renewal', 'cancellation'], true)) {
            throw new InvalidArgumentException("Invalid request type. Must be 'renewal' or 'cancellation'.");
        }

        if ($normalizedType === 'renewal') {
            $validDurations = [1, 3, 6, 12];
            $durationMonths = (int) ($durationMonths ?: 12);
            if (!in_array($durationMonths, $validDurations, true)) {
                throw new InvalidArgumentException('Renewal duration must be 1 month, 3 months, 6 months, or 1 year (12 months).');
            }
        } else {
            $durationMonths = null;
        }

        // Create the contract request pending admin review
        $contractRequest = VendorContractRequest::create([
            'vendor_id' => $vendor->id,
            'type' => $normalizedType,
            'requested_duration_months' => $durationMonths,
            'reason' => $reason,
            'status' => 'pending',
        ]);

        // Update vendor contract status without automatically renewing or cancelling
        if ($normalizedType === 'renewal') {
            $vendor->update([
                'contract_status' => 'renewal_requested',
                'renewal_requested_at' => now(),
                'renewal_notes' => $reason,
            ]);
        } else {
            $vendor->update([
                'contract_status' => 'cancellation_requested',
                'cancellation_requested_at' => now(),
                'renewal_notes' => $reason,
            ]);
        }

        return $contractRequest;
    }

    /**
     * Admin reviews a submitted contract request and either approves or rejects it.
     */
    public function reviewContractRequest(
        VendorContractRequest $request,
        string $decision,
        ?string $adminNotes = null,
        ?User $reviewer = null,
        ?int $customMonths = null
    ): VendorContractRequest {
        $decision = strtolower(trim($decision));
        if (!in_array($decision, ['approved', 'rejected'], true)) {
            throw new InvalidArgumentException("Review decision must be 'approved' or 'rejected'.");
        }

        $vendor = $request->vendor;

        if ($decision === 'approved') {
            if ($request->type === 'renewal') {
                $additionalMonths = $customMonths ?: ($request->requested_duration_months ?: 12);

                // Check whether this renewal follows a cancellation, expiration, or is a brand new contract.
                // If a previous contract was cancelled (or expired), remaining months must NEVER carry over!
                $lastApprovedRequest = $vendor->contractRequests()
                    ->where('id', '!=', $request->id)
                    ->where('status', 'approved')
                    ->latest()
                    ->first();

                $isCancelledOrFresh = $vendor->contract_status === 'cancelled'
                    || ($lastApprovedRequest && $lastApprovedRequest->type === 'cancellation')
                    || empty($vendor->contract_end_date)
                    || Carbon::parse($vendor->contract_end_date)->isPast()
                    || Carbon::parse($vendor->contract_end_date)->isSameDay(now());

                if ($isCancelledOrFresh) {
                    // New contract starts fresh from today; exclude any months from previously cancelled contract
                    $newStart = now()->toDateString();
                    $newEnd = now()->copy()->addMonths($additionalMonths)->toDateString();
                    $newDuration = $additionalMonths;
                } else {
                    // Ongoing active contract being extended
                    $newStart = $vendor->contract_start_date ? Carbon::parse($vendor->contract_start_date)->toDateString() : now()->toDateString();
                    $currentEnd = Carbon::parse($vendor->contract_end_date);
                    $newEnd = $currentEnd->copy()->addMonths($additionalMonths)->toDateString();
                    $newDuration = (int) $vendor->contract_duration_months + $additionalMonths;
                }

                $vendor->update([
                    'contract_start_date' => $newStart,
                    'contract_duration_months' => $newDuration,
                    'contract_end_date' => $newEnd,
                    'contract_status' => 'active',
                    'renewal_notes' => null,
                ]);
            } else {
                // Cancellation approved: contract is officially cancelled immediately
                $vendor->update([
                    'contract_status' => 'cancelled',
                    'contract_end_date' => now()->toDateString(), // Cancelled immediately; zero future remaining months
                    'contract_duration_months' => 0,
                    'renewal_notes' => null,
                ]);

                // Vacate assigned stall if present
                if ($vendor->stall) {
                    $vendor->stall->update([
                        'status' => StallStatus::Vacant,
                        'vendor_id' => null,
                    ]);
                }
            }
        } else {
            // Rejected: Revert vendor contract status based on end date
            $today = now()->startOfDay();
            if ($vendor->contract_end_date) {
                $endDate = Carbon::parse($vendor->contract_end_date)->startOfDay();
                $daysRemaining = (int) $today->diffInDays($endDate, false);
                if ($daysRemaining < 0) {
                    $newStatus = 'expired';
                } elseif ($daysRemaining <= 30) {
                    $newStatus = 'expiring_soon';
                } else {
                    $newStatus = 'active';
                }
            } else {
                $newStatus = 'active';
            }

            $vendor->update([
                'contract_status' => $newStatus,
            ]);
        }

        // Record request resolution
        $request->update([
            'status' => $decision,
            'admin_notes' => $adminNotes,
            'reviewed_by' => $reviewer?->id,
            'reviewed_at' => now(),
        ]);

        // Automatically notify vendor of the approval or rejection
        if ($vendor->user) {
            $vendor->user->notify(new ContractRequestReviewedNotification($request->fresh(['vendor'])));
        }

        return $request;
    }

    /**
     * Backward-compatible helper for renewal request.
     */
    public function requestRenewal(Vendor $vendor, ?string $notes = null, int $durationMonths = 12): Vendor
    {
        $this->submitContractRequest($vendor, 'renewal', $durationMonths, $notes);
        return $vendor->fresh();
    }

    /**
     * Backward-compatible helper for approving renewal directly.
     */
    public function approveRenewal(Vendor $vendor, int $additionalMonths = 12, ?User $reviewer = null, ?string $notes = null): Vendor
    {
        $pending = $vendor->contractRequests()->where('type', 'renewal')->where('status', 'pending')->latest()->first();

        if ($pending) {
            $this->reviewContractRequest($pending, 'approved', $notes, $reviewer, $additionalMonths);
        } else {
            // Direct admin renewal extension without prior request
            $lastApprovedRequest = $vendor->contractRequests()
                ->where('status', 'approved')
                ->latest()
                ->first();

            $isCancelledOrFresh = $vendor->contract_status === 'cancelled'
                || ($lastApprovedRequest && $lastApprovedRequest->type === 'cancellation')
                || empty($vendor->contract_end_date)
                || Carbon::parse($vendor->contract_end_date)->isPast()
                || Carbon::parse($vendor->contract_end_date)->isSameDay(now());

            if ($isCancelledOrFresh) {
                $newStart = now()->toDateString();
                $newEnd = now()->copy()->addMonths($additionalMonths)->toDateString();
                $newDuration = $additionalMonths;
            } else {
                $newStart = $vendor->contract_start_date ? Carbon::parse($vendor->contract_start_date)->toDateString() : now()->toDateString();
                $currentEnd = Carbon::parse($vendor->contract_end_date);
                $newEnd = $currentEnd->copy()->addMonths($additionalMonths)->toDateString();
                $newDuration = (int) $vendor->contract_duration_months + $additionalMonths;
            }

            $vendor->update([
                'contract_start_date' => $newStart,
                'contract_duration_months' => $newDuration,
                'contract_end_date' => $newEnd,
                'contract_status' => 'active',
                'renewal_notes' => null,
            ]);

            // Create record as approved
            $req = VendorContractRequest::create([
                'vendor_id' => $vendor->id,
                'type' => 'renewal',
                'requested_duration_months' => $additionalMonths,
                'status' => 'approved',
                'admin_notes' => $notes ?: 'Renewed by market administration.',
                'reviewed_by' => $reviewer?->id,
                'reviewed_at' => now(),
            ]);

            if ($vendor->user) {
                $vendor->user->notify(new ContractRequestReviewedNotification($req));
            }
        }

        return $vendor->fresh();
    }

    private function notifyContractExpiring(Vendor $vendor): void
    {
        if ($vendor->user) {
            $vendor->user->notify(new ContractExpiringNotification($vendor));
        }
    }

    private function notifyContractExpired(Vendor $vendor): void
    {
        if ($vendor->user) {
            $vendor->user->notify(new ContractExpiredNotification($vendor));
        }
    }
}
