<?php

namespace App\Services\Admin;

use App\Models\Stall;
use App\Models\StallComplaint;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class StallComplaintService
{
    public function getIndexData(array $filters): array
    {
        $query = StallComplaint::query()->with([
            'stall:id,stall_number,store_name,section',
            'user:id,name,email',
            'resolver:id,name',
        ]);

        if (!empty($filters['stall_id'])) {
            $query->where('stall_id', $filters['stall_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['complaint_type'])) {
            $query->where('complaint_type', $filters['complaint_type']);
        }

        if (!empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('stall_number', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
                  ->orWhereHas('stall', fn ($sq) => $sq->where('store_name', 'like', "%{$s}%"));
            });
        }

        $complaints = $query->orderByDesc('created_at')->paginate(15)->withQueryString();

        $stats = [
            'total' => StallComplaint::count(),
            'pending' => StallComplaint::where('status', 'pending')->count(),
            'in_review' => StallComplaint::where('status', 'in_review')->count(),
            'complied' => StallComplaint::where('status', 'complied')->count(),
            'resolved' => StallComplaint::where('status', 'resolved')->count(),
        ];

        $stalls = Stall::where('status', 'occupied')->orderBy('stall_number')->get(['id', 'stall_number', 'store_name', 'section']);

        return [
            'complaints' => $complaints,
            'stats' => $stats,
            'filters' => $filters,
            'stalls' => $stalls,
            'types' => [
                ['value' => 'bad_smell', 'label' => 'Bad Smell / Odor'],
                ['value' => 'cleanliness', 'label' => 'Cleanliness & Sanitation'],
                ['value' => 'noise', 'label' => 'Excessive Noise'],
                ['value' => 'obstruction', 'label' => 'Pathway Obstruction'],
                ['value' => 'improper_handling', 'label' => 'Improper Food Handling'],
                ['value' => 'other', 'label' => 'Other Concerns'],
            ],
            'statuses' => [
                ['value' => 'pending', 'label' => 'Pending Review'],
                ['value' => 'in_review', 'label' => 'Under Inspection'],
                ['value' => 'complied', 'label' => 'Complied by Vendor'],
                ['value' => 'resolved', 'label' => 'Resolved'],
                ['value' => 'dismissed', 'label' => 'Dismissed'],
            ],
        ];
    }

    public function createComplaint(?User $user, Stall $stall, array $data): StallComplaint
    {
        return StallComplaint::create([
            'stall_id' => $stall->id,
            'user_id' => $user?->id,
            'stall_number' => $stall->stall_number,
            'complaint_type' => $data['complaint_type'],
            'description' => $data['description'],
            'status' => 'pending',
        ]);
    }

    public function updateStatus(StallComplaint $complaint, User $admin, string $status, ?string $actionTaken = null): StallComplaint
    {
        $complaint->update([
            'status' => $status,
            'action_taken' => $actionTaken ?? $complaint->action_taken,
            'resolved_at' => in_array($status, ['complied', 'resolved'], true) ? now() : null,
            'resolved_by' => in_array($status, ['complied', 'resolved'], true) ? $admin->id : null,
        ]);

        return $complaint->fresh(['stall', 'user', 'resolver']);
    }
}
