<?php

use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('defaults vendor operating hours to 4:00 AM to 8:00 PM', function () {
    $user = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $user->id,
        'stall_name' => 'Stall 1',
        'stall_location' => 'Section A',
        'product_categories' => ['Meat'],
        'status' => 'approved',
    ]);

    expect($vendor->opening_time)->toBe('04:00');
    expect($vendor->closing_time)->toBe('20:00');
    expect($vendor->operating_hours)->toBe('4:00 AM - 8:00 PM');
});

it('automatically updates store availability status based on the schedule', function () {
    $user = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $user->id,
        'stall_name' => 'Stall 1',
        'stall_location' => 'Section A',
        'product_categories' => ['Meat'],
        'status' => 'approved',
    ]);

    // Daytime at 10:00 AM Manila time -> Open
    Carbon::setTestNow(Carbon::createFromTimeString('10:00:00', 'Asia/Manila'));
    expect($vendor->isOpen())->toBeTrue();
    expect($vendor->is_open)->toBeTrue();

    // Nighttime at 11:00 PM Manila time -> Closed
    Carbon::setTestNow(Carbon::createFromTimeString('23:00:00', 'Asia/Manila'));
    expect($vendor->isOpen())->toBeFalse();
    expect($vendor->is_open)->toBeFalse();

    // Early morning at 3:30 AM Manila time -> Closed
    Carbon::setTestNow(Carbon::createFromTimeString('03:30:00', 'Asia/Manila'));
    expect($vendor->isOpen())->toBeFalse();
    expect($vendor->is_open)->toBeFalse();

    Carbon::setTestNow(); // Reset time
});

it('returns operating hours and store status via marketplace vendor endpoint', function () {
    $user = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $user->id,
        'stall_name' => 'Nena Store',
        'stall_location' => 'Stall 5',
        'product_categories' => ['Vegetables'],
        'status' => 'approved',
    ]);

    Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Tomatoes',
        'category' => 'Vegetables',
        'price' => 50,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    Carbon::setTestNow(Carbon::createFromTimeString('14:00:00', 'Asia/Manila'));

    $response = $this->getJson("/api/v1/marketplace/vendors/{$vendor->id}");

    $response->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.vendor.stall_name', 'Nena Store')
        ->assertJsonPath('data.vendor.operating_hours', '4:00 AM - 8:00 PM')
        ->assertJsonPath('data.vendor.is_open', true)
        ->assertJsonCount(1, 'data.products');

    Carbon::setTestNow();
});

it('allows vendors to update operating hours in profile', function () {
    $user = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $user->id,
        'stall_name' => 'Custom Hours Stall',
        'stall_location' => 'Stall 9',
        'product_categories' => ['Fish'],
        'status' => 'approved',
    ]);

    Sanctum::actingAs($user);

    $response = $this->putJson('/api/v1/vendor/profile/business', [
        'opening_time' => '05:00',
        'closing_time' => '19:00',
    ]);

    $response->assertOk()
        ->assertJsonPath('status', 'success');

    $vendor->refresh();
    expect($vendor->opening_time)->toBe('05:00');
    expect($vendor->closing_time)->toBe('19:00');
    expect($vendor->operating_hours)->toBe('5:00 AM - 7:00 PM');
});
