<?php

use App\Http\Controllers\Admin\AiRecommendationManagementController;
use App\Http\Controllers\Admin\FeedbackController;
use App\Http\Controllers\Admin\InventoryMonitoringController;
use App\Http\Controllers\Admin\OrderManagementController;
use App\Http\Controllers\Admin\PaymentManagementController;
use App\Http\Controllers\Admin\ProductManagementController;
use App\Http\Controllers\Admin\ReportsAnalyticsController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\Admin\StallController;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\VendorApprovalController;
use App\Http\Controllers\Admin\VendorManagementController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->prefix('admin')->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Section Management
    Route::get('dashboard/vendors/sections', [SectionController::class, 'index'])->name('sections.index');
    Route::post('dashboard/vendors/sections', [SectionController::class, 'store'])->name('sections.store');
    Route::put('dashboard/vendors/sections/{section}', [SectionController::class, 'update'])->name('sections.update');
    Route::delete('dashboard/vendors/sections/{section}', [SectionController::class, 'destroy'])->name('sections.destroy');

    // Stall Management
    Route::get('dashboard/vendors/stalls', [StallController::class, 'index'])->name('stalls.index');
    Route::post('dashboard/vendors/stalls', [StallController::class, 'store'])->name('stalls.store');
    Route::put('dashboard/vendors/stalls/{stall}', [StallController::class, 'update'])->name('stalls.update');
    Route::delete('dashboard/vendors/stalls/{stall}', [StallController::class, 'destroy'])->name('stalls.destroy');

    // Vendor Management (All Vendors)
    Route::get('dashboard/vendors', [VendorManagementController::class, 'index'])->name('vendors.index');
    Route::post('dashboard/vendors/{vendor}/suspend', [VendorManagementController::class, 'suspend'])->name('vendors.suspend');
    Route::post('dashboard/vendors/{vendor}/activate', [VendorManagementController::class, 'activate'])->name('vendors.activate');

    // Vendor Pending Approval
    Route::get('dashboard/vendors/pending', [VendorApprovalController::class, 'index'])->name('vendors.pending');
    Route::post('dashboard/vendors/{vendor}/approve', [VendorApprovalController::class, 'approve'])->name('vendors.approve');
    Route::post('dashboard/vendors/{vendor}/reject', [VendorApprovalController::class, 'reject'])->name('vendors.reject');

    // Vendor Documents
    Route::get('dashboard/vendors/documents', [VendorApprovalController::class, 'documents'])->name('vendors.documents');

    // Product Management
    Route::get('dashboard/products', [ProductManagementController::class, 'index'])->name('products.index');
    Route::put('dashboard/products/{product}', [ProductManagementController::class, 'update'])->name('products.update');
    Route::delete('dashboard/products/{product}', [ProductManagementController::class, 'destroy'])->name('products.destroy');
    Route::patch('dashboard/products/{product}/toggle', [ProductManagementController::class, 'toggleAvailability'])->name('products.toggle');

    // Payment Management
    Route::get('dashboard/payments', [PaymentManagementController::class, 'index'])->name('payments.index');

    // Inventory Monitoring
    Route::get('dashboard/inventory', [InventoryMonitoringController::class, 'index'])->name('inventory.index');

    // Order Management
    Route::get('dashboard/orders', [OrderManagementController::class, 'index'])->name('orders.index');
    Route::patch('dashboard/orders/{order}/status', [OrderManagementController::class, 'updateStatus'])->name('orders.update-status');

    // Reports & Analytics
    Route::get('dashboard/reports', [ReportsAnalyticsController::class, 'index'])->name('reports.index');

    // AI Recommendation Management
    Route::get('dashboard/recommendations', [AiRecommendationManagementController::class, 'index'])->name('recommendations.index');
    Route::delete('dashboard/recommendations/{recommendation}', [AiRecommendationManagementController::class, 'destroy'])->name('recommendations.destroy');
    Route::delete('dashboard/recommendations', [AiRecommendationManagementController::class, 'destroyAll'])->name('recommendations.destroy-all');

    // Feedback & Complaints Management
    Route::get('dashboard/feedback', [FeedbackController::class, 'index'])->name('feedback.index');
    Route::post('dashboard/feedback/{review}/respond', [FeedbackController::class, 'respond'])->name('feedback.respond');
    Route::patch('dashboard/feedback/{review}/status', [FeedbackController::class, 'updateStatus'])->name('feedback.update-status');

    // User Management - Manages customer accounts, including viewing, updating, activating, or deactivating users
    Route::get('dashboard/users', [UserManagementController::class, 'index'])->name('users.index');
    Route::put('dashboard/users/{user}', [UserManagementController::class, 'update'])->name('users.update');
    Route::patch('dashboard/users/{user}/toggle', [UserManagementController::class, 'toggleStatus'])->name('users.toggle');
    Route::patch('dashboard/users/{user}/activate', [UserManagementController::class, 'activate'])->name('users.activate');
    Route::patch('dashboard/users/{user}/deactivate', [UserManagementController::class, 'deactivate'])->name('users.deactivate');
    Route::delete('dashboard/users/{user}', [UserManagementController::class, 'destroy'])->name('users.destroy');
});

require __DIR__.'/settings.php';
