<?php

/**
 * API versioning -> for scalable future changes 
 */

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\StallController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\VendorRegistrationController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/vendor/register', [VendorRegistrationController::class, 'register']);

// Public endpoints for registration form data
Route::get('/sections', [StallController::class, 'sections']);
Route::get('/stalls/vacant', [StallController::class, 'vacantStalls']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'profile']);
    Route::get('/vendor/status', [VendorRegistrationController::class, 'status']);

    // Vendor Products CRUD
    Route::get('/products', [\App\Http\Controllers\Api\ProductController::class, 'index']);
    Route::post('/products', [\App\Http\Controllers\Api\ProductController::class, 'store']);
    Route::put('/products/{product}', [\App\Http\Controllers\Api\ProductController::class, 'update']);
    Route::delete('/products/{product}', [\App\Http\Controllers\Api\ProductController::class, 'destroy']);

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
});

Route::apiResource('tasks', TaskController::class);
