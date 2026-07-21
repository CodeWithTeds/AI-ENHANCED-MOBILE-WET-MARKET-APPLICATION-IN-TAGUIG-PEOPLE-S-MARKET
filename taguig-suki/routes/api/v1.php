<?php

/**
 * API versioning -> for scalable future changes 
 */

use App\Http\Controllers\Api\AuthController;
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
});

Route::apiResource('tasks', TaskController::class);
