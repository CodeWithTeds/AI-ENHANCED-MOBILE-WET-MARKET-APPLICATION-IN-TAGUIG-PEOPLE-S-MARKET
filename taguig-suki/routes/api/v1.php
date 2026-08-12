<?php

/**
 * API versioning -> for scalable future changes
 */

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerProfileController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\StallController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\VendorProfileController;
use App\Http\Controllers\Api\VendorRegistrationController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/vendor/register', [VendorRegistrationController::class, 'register']);

// Public endpoints for registration form data
Route::get('/sections', [StallController::class, 'sections']);
Route::get('/stalls/vacant', [StallController::class, 'vacantStalls']);

// Public marketplace endpoints (customer browsing)
Route::prefix('marketplace')->group(function () {
    Route::get('/featured', [MarketplaceController::class, 'featured']);
    Route::get('/products', [MarketplaceController::class, 'browse']);
    Route::get('/products/search', [MarketplaceController::class, 'search']);
    Route::get('/products/{product}', [MarketplaceController::class, 'show']);
    Route::get('/categories', [MarketplaceController::class, 'categories']);
});

// AI Recipe Search (public — no auth required)
Route::get('/recipes/search', [RecipeController::class, 'search']);

// Public reviews (vendors, products, recipes) + aggregates
Route::get('/reviews/vendor/{vendor}', [ReviewController::class, 'vendorReviews']);
Route::get('/reviews/product/{product}', [ReviewController::class, 'productReviews']);
Route::get('/reviews/recipe', [ReviewController::class, 'recipeReviews']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'profile']);
    Route::get('/vendor/status', [VendorRegistrationController::class, 'status']);

    // Vendor Products CRUD
    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{product}', [ProductController::class, 'update']);
    Route::delete('/products/{product}', [ProductController::class, 'destroy']);

    // Customer Profile & Settings
    Route::get('/profile', [CustomerProfileController::class, 'show']);
    Route::put('/profile', [CustomerProfileController::class, 'updateProfile']);
    Route::put('/profile/password', [CustomerProfileController::class, 'changePassword']);
    Route::put('/profile/notifications', [CustomerProfileController::class, 'updateNotifications']);

    // Vendor Profile & Settings
    Route::get('/vendor/profile', [VendorProfileController::class, 'show']);
    Route::put('/vendor/profile/business', [VendorProfileController::class, 'updateBusiness']);
    Route::put('/vendor/profile/password', [VendorProfileController::class, 'changePassword']);
    Route::put('/vendor/profile/notifications', [VendorProfileController::class, 'updateNotifications']);

    // Vendor Inventory Management
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/summary', [InventoryController::class, 'summary']);
    Route::get('/inventory/logs', [InventoryController::class, 'logs']);
    Route::post('/inventory', [InventoryController::class, 'store']);
    Route::get('/inventory/{inventory}', [InventoryController::class, 'show']);
    Route::put('/inventory/{inventory}', [InventoryController::class, 'update']);
    Route::post('/inventory/{inventory}/adjust', [InventoryController::class, 'adjustStock']);
    Route::get('/inventory/{inventory}/history', [InventoryController::class, 'history']);
    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);

    // Customer Orders
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::get('/orders/{id}/track', [OrderController::class, 'track']);

    // Customer Reviews (only from completed orders)
    Route::get('/reviews/eligible', [ReviewController::class, 'eligible']);
    Route::post('/reviews/vendor', [ReviewController::class, 'storeVendor']);
    Route::post('/reviews/product', [ReviewController::class, 'storeProduct']);
    Route::post('/reviews/recipe', [ReviewController::class, 'storeRecipe']);
    Route::put('/reviews/{review}', [ReviewController::class, 'update']);
    Route::delete('/reviews/{review}', [ReviewController::class, 'destroy']);

    // Vendor Orders (orders that contain this vendor's products)
    Route::get('/vendor/orders', [OrderController::class, 'vendorOrders']);
    Route::patch('/vendor/orders/{id}/status', [OrderController::class, 'updateStatus']);
});

Route::apiResource('tasks', TaskController::class);
