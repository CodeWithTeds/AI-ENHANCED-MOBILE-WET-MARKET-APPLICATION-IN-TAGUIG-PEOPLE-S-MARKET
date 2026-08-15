<?php

use App\Enums\VendorStatus;
use App\Models\Product;
use App\Models\Stall;
use App\Models\User;
use App\Models\Vendor;

function makeAdmin(): User
{
    return User::factory()->create(['is_admin' => true]);
}

function makeVendor(string $status = 'approved', array $overrides = []): Vendor
{
    $user = User::factory()->create();

    return Vendor::create(array_merge([
        'user_id' => $user->id,
        'stall_name' => 'Aling Rosa\'s Store',
        'stall_location' => 'Wet Section, Stall 12',
        'product_categories' => ['meat', 'vegetables'],
        'status' => $status,
    ], $overrides));
}

test('admin can view the all vendors page', function () {
    $this->actingAs(makeAdmin());

    makeVendor('approved');
    makeVendor('pending');
    makeVendor('suspended');
    makeVendor('rejected');

    $response = $this->get(route('vendors.index'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/vendors/index')
            ->has('vendors.data', 4)
            ->where('stats.total', 4)
            ->where('stats.approved', 1)
            ->where('stats.pending', 1)
            ->where('stats.suspended', 1)
            ->where('stats.rejected', 1)
            ->has('statuses', 4));
});

test('vendors can be filtered by status', function () {
    $this->actingAs(makeAdmin());

    makeVendor('approved');
    makeVendor('suspended');

    $this->get(route('vendors.index', ['status' => 'suspended']))
        ->assertInertia(fn ($page) => $page
            ->has('vendors.data', 1)
            ->where('vendors.data.0.status', 'suspended'));
});

test('vendors can be searched by name or stall', function () {
    $this->actingAs(makeAdmin());

    makeVendor('approved', ['stall_name' => 'Mang Tony\'s Meat Shop']);
    makeVendor('approved', ['stall_name' => 'Aling Rosa\'s Store']);

    $this->get(route('vendors.index', ['search' => 'Tony']))
        ->assertInertia(fn ($page) => $page
            ->has('vendors.data', 1)
            ->where('vendors.data.0.stall_name', 'Mang Tony\'s Meat Shop'));
});

test('admin can suspend an approved vendor', function () {
    $this->actingAs(makeAdmin());

    $vendor = makeVendor('approved');

    $this->post(route('vendors.suspend', $vendor));

    $this->assertDatabaseHas('vendors', ['id' => $vendor->id, 'status' => VendorStatus::Suspended->value]);
});

test('admin can activate a suspended vendor', function () {
    $this->actingAs(makeAdmin());

    $vendor = makeVendor('suspended');

    $this->post(route('vendors.activate', $vendor));

    $this->assertDatabaseHas('vendors', ['id' => $vendor->id, 'status' => VendorStatus::Approved->value]);
});

test('vendor list includes stall number and product counts', function () {
    $this->actingAs(makeAdmin());

    $user = User::factory()->create();
    $vendor = Vendor::create([
        'user_id' => $user->id,
        'stall_name' => 'Fresh Catch',
        'stall_location' => 'Wet Section, Stall 3',
        'product_categories' => ['fish'],
        'status' => 'approved',
    ]);
    Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Tilapia',
        'category' => 'fish',
        'price' => 100,
        'unit' => 'kg',
        'is_available' => true,
    ]);
    Stall::create([
        'section' => 'wet',
        'stall_number' => 'WS-03',
        'store_name' => 'Fresh Catch',
        'vendor_id' => $user->id,
        'status' => 'occupied',
    ]);

    $this->get(route('vendors.index'))
        ->assertInertia(fn ($page) => $page
            ->where('vendors.data.0.stall_number', 'WS-03')
            ->where('vendors.data.0.products_count', 1));
});
