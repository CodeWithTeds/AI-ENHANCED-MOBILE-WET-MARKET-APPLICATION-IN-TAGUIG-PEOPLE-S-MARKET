<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectVendorRequest;
use App\Models\Vendor;
use App\Services\Admin\VendorApprovalService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class VendorApprovalController extends Controller
{
    public function __construct(private readonly VendorApprovalService $approvalService) {}

    public function index()
    {
        return Inertia::render('admin/pending/index', $this->approvalService->getPendingData());
    }

    public function documents(Request $request)
    {
        return Inertia::render('admin/documents/index', $this->approvalService->getDocumentsData($request->get('status')));
    }

    public function approve(Vendor $vendor)
    {
        return back()->with('success', "Vendor '{$this->approvalService->approve($vendor)->stall_name}' has been approved.");
    }

    public function reject(RejectVendorRequest $request, Vendor $vendor)
    {
        return back()->with('success', "Vendor '{$this->approvalService->reject($vendor, $request->rejection_reason)->stall_name}' has been rejected.");
    }
}
