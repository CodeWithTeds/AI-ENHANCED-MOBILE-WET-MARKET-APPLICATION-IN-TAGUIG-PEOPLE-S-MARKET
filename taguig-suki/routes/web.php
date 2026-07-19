<?php

use App\Http\Controllers\Admin\StallController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->prefix('admin')->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Section Management
    Route::get('dashboard/vendors/sections', [\App\Http\Controllers\Admin\SectionController::class, 'index'])->name('sections.index');
    Route::post('dashboard/vendors/sections', [\App\Http\Controllers\Admin\SectionController::class, 'store'])->name('sections.store');
    Route::put('dashboard/vendors/sections/{section}', [\App\Http\Controllers\Admin\SectionController::class, 'update'])->name('sections.update');
    Route::delete('dashboard/vendors/sections/{section}', [\App\Http\Controllers\Admin\SectionController::class, 'destroy'])->name('sections.destroy');

    // Stall Management
    Route::get('dashboard/vendors/stalls', [StallController::class, 'index'])->name('stalls.index');
    Route::post('dashboard/vendors/stalls', [StallController::class, 'store'])->name('stalls.store');
    Route::put('dashboard/vendors/stalls/{stall}', [StallController::class, 'update'])->name('stalls.update');
    Route::delete('dashboard/vendors/stalls/{stall}', [StallController::class, 'destroy'])->name('stalls.destroy');
});

require __DIR__ . '/settings.php';
