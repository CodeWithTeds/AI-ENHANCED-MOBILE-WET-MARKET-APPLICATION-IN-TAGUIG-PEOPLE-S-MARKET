<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\Request;
use Inertia\Inertia;

class VendorApprovalController extends Controller
{
    /**
     * Show pending vendor registrations.
     */
    public function index(Request $request)
    {
        $vendors = Vendor::with(['user', 'documents'])
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->paginate(15);

        $stats = [
            'pending' => Vendor::where('status', 'pending')->count(),
            'approved' => Vendor::where('status', 'approved')->count(),
            'rejected' => Vendor::where('status', 'rejected')->count(),
            'total' => Vendor::count(),
        ];

        return Inertia::render('admin/pending/index', [
            'vendors' => $vendors,
            'stats' => $stats,
        ]);
    }

    /**
     * Show all vendor documents (across all statuses).
     */
    public function documents(Request $request)
    {
        $status = $request->get('status');

        $query = Vendor::with(['user', 'documents']);

        if ($status) {
            $query->where('status', $status);
        }

        $vendors = $query->orderByDesc('created_at')->paginate(15);

        $stats = [
            'pending' => Vendor::where('status', 'pending')->count(),
            'approved' => Vendor::where('status', 'approved')->count(),
            'rejected' => Vendor::where('status', 'rejected')->count(),
            'total' => Vendor::count(),
        ];

        return Inertia::render('admin/documents/index', [
            'vendors' => $vendors,
            'stats' => $stats,
            'filters' => [
                'status' => $status,
            ],
        ]);
    }

    /**
     * Approve a vendor registration.
     */
    public function approve(Vendor $vendor)
    {
        $vendor->update([
            'status' => 'approved',
            'approved_at' => now(),
            'rejection_reason' => null,
        ]);

        return back()->with('success', "Vendor '{$vendor->stall_name}' has been approved.");
    }

    /**
     * Reject a vendor registration.
     */
    public function reject(Request $request, Vendor $vendor)
    {
        $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $vendor->update([
            'status' => 'rejected',
            'rejection_reason' => $request->rejection_reason,
        ]);

        return back()->with('success', "Vendor '{$vendor->stall_name}' has been rejected.");
    }
}
