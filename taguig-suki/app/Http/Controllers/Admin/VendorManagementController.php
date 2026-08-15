<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use App\Services\Admin\VendorManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VendorManagementController extends Controller
{
    public function __construct(private readonly VendorManagementService $vendorService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/vendors/index', $this->vendorService->getIndexData(
            $request->only(['search', 'status', 'category'])
        ));
    }

    public function suspend(Vendor $vendor): RedirectResponse
    {
        $this->vendorService->suspend($vendor);

        return back()->with('success', "Vendor \"{$vendor->stall_name}\" has been suspended.");
    }

    public function activate(Vendor $vendor): RedirectResponse
    {
        $this->vendorService->activate($vendor);

        return back()->with('success', "Vendor \"{$vendor->stall_name}\" has been activated.");
    }
}
