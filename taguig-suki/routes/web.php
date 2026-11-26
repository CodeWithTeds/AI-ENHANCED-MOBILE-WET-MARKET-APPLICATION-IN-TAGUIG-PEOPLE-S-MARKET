<?php

use App\Http\Controllers\Admin\AdminNotificationController;
use App\Http\Controllers\Admin\AiRecommendationManagementController;
use App\Http\Controllers\Admin\CustomerVerificationController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FeedbackController;
use App\Http\Controllers\Admin\InventoryMonitoringController;
use App\Http\Controllers\Admin\OrderManagementController;
use App\Http\Controllers\Admin\PaymentManagementController;
use App\Http\Controllers\Admin\ProductManagementController;
use App\Http\Controllers\Admin\ReportsAnalyticsController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\Admin\StallComplaintController;
use App\Http\Controllers\Admin\StallController;
use App\Http\Controllers\Admin\StallRentalController;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\VendorApprovalController;
use App\Http\Controllers\Admin\VendorManagementController;
use App\Models\Product;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::get('orders/{order:order_number}/receipt', [OrderManagementController::class, 'receipt'])->name('orders.receipt');

Route::middleware(['auth', 'verified'])->prefix('admin')->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

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

    // Stall Monitoring & Customer Complaints
    Route::get('dashboard/vendors/stalls/monitoring', [StallComplaintController::class, 'index'])->name('stalls.monitoring');
    Route::patch('dashboard/vendors/stalls/complaints/{complaint}', [StallComplaintController::class, 'updateStatus'])->name('stalls.complaints.update');

    // Monthly Stall Rental Payment Monitoring & Contracts
    Route::get('dashboard/vendors/rentals', [StallRentalController::class, 'index'])->name('rentals.index');
    Route::get('dashboard/rentals', fn () => redirect()->route('rentals.index'));
    Route::post('dashboard/vendors/rentals/generate', [StallRentalController::class, 'generateBills'])->name('rentals.generate');
    Route::patch('dashboard/vendors/rentals/{rental}/status', [StallRentalController::class, 'updateStatus'])->name('rentals.update-status');
    Route::patch('dashboard/vendors/rentals/{rental}/verify', [StallRentalController::class, 'verifyPayment'])->name('rentals.verify');
    Route::post('dashboard/vendors/{vendor}/contract/renew-approve', [StallRentalController::class, 'renewContractApprove'])->name('vendors.contract.renew-approve');
    Route::post('dashboard/vendors/rentals/contract-requests/{contractRequest}/review', [StallRentalController::class, 'reviewContractRequest'])->name('rentals.contract-requests.review');
    Route::get('dashboard/reports/rentals', [StallRentalController::class, 'reports'])->name('reports.rentals');

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

    // Inventory Monitoring
    Route::get('dashboard/inventory', [InventoryMonitoringController::class, 'index'])->name('inventory.index');

    // Payment & Order Management
    Route::get('dashboard/orders', [OrderManagementController::class, 'index'])->name('orders.index');
    Route::get('dashboard/payments', [OrderManagementController::class, 'index'])->name('payments.index');
    Route::patch('dashboard/orders/{order}/status', [OrderManagementController::class, 'updateStatus'])->name('orders.update-status');
    Route::patch('dashboard/payments/{order}/verify', [PaymentManagementController::class, 'verify'])->name('payments.verify');

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
    Route::post('dashboard/users/{user}/reject', [UserManagementController::class, 'reject'])->name('users.reject');

    // Customer ID Verification (Redirects to User Management)
    Route::get('dashboard/verifications', [CustomerVerificationController::class, 'index'])->name('verifications.index');
    Route::post('dashboard/verifications/{customerVerification}/approve', [CustomerVerificationController::class, 'approve'])->name('verifications.approve');
    Route::post('dashboard/verifications/{customerVerification}/reject', [CustomerVerificationController::class, 'reject'])->name('verifications.reject');

    // Admin Notifications
    Route::get('dashboard/notifications', [AdminNotificationController::class, 'index'])->name('admin.notifications.index');
    Route::patch('dashboard/notifications/{notification}/read', [AdminNotificationController::class, 'markRead'])->name('admin.notifications.read');
    Route::post('dashboard/notifications/read-all', [AdminNotificationController::class, 'markAllRead'])->name('admin.notifications.read-all');
});

Route::get('storage/{path}', function (string $path) {
    $fullPath = storage_path('app/public/'.$path);
    if (file_exists($fullPath)) {
        return response()->file($fullPath);
    }

    // Fallback: If uploaded product image was lost on ephemeral server container,
    // serve matching photographic image based on product name or category
    if (str_starts_with($path, 'products/')) {
        $product = Product::where('image', $path)
            ->orWhere('image', 'like', "%{$path}%")
            ->first();

        $name = strtolower($product?->name ?? '');
        $cat = strtolower($product?->category ?? '');

        // 1. Pork / Meat
        if (str_contains($name, 'pork') || str_contains($name, 'liempo') || str_contains($name, 'baboy')) {
            $porkImg = storage_path('app/public/products/14/pork_liempo.jpg');
            if (file_exists($porkImg)) {
                return response()->file($porkImg);
            }
            if (file_exists(public_path('images/categories/meat.jpg'))) {
                return response()->file(public_path('images/categories/meat.jpg'));
            }
        }

        // 2. Fish / Seafood
        if (str_contains($name, 'tilapia') || str_contains($name, 'bangus') || str_contains($name, 'fish') || $cat === 'fish' || $cat === 'seafood') {
            if (file_exists(public_path('images/categories/fish.jpg'))) {
                return response()->file(public_path('images/categories/fish.jpg'));
            }
        }

        // 3. Poultry / Chicken / Egg
        if (str_contains($name, 'chicken') || str_contains($name, 'itlog') || str_contains($name, 'poultry') || $cat === 'poultry') {
            if (file_exists(public_path('images/categories/poultry.jpg'))) {
                return response()->file(public_path('images/categories/poultry.jpg'));
            }
        }

        // 4. Vegetables
        if (str_contains($name, 'sibuyas') || str_contains($name, 'kamatis') || str_contains($name, 'kangkong') || str_contains($name, 'gulay') || $cat === 'vegetables') {
            if (file_exists(public_path('images/categories/vegetables.jpg'))) {
                return response()->file(public_path('images/categories/vegetables.jpg'));
            }
        }

        // 5. General category image
        $cleanCat = str_replace(' ', '-', $cat);
        $catFile = public_path("images/categories/{$cleanCat}.jpg");
        if ($cat && file_exists($catFile)) {
            return response()->file($catFile);
        }

        // 6. Generic meat/product fallback
        if (file_exists(public_path('images/categories/meat.jpg'))) {
            return response()->file(public_path('images/categories/meat.jpg'));
        }
    }

    abort(404);
})->where('path', '.*')->name('storage.fallback');

require __DIR__.'/settings.php';
