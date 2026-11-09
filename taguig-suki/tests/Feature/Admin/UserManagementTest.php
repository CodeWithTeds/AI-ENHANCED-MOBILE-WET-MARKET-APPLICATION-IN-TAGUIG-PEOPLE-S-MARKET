<?php

use App\Models\User;
use App\Models\Vendor;

test('guests are redirected from user management', function () {
    $response = $this->get('/admin/dashboard/users');
    $response->assertRedirect(route('login'));
});

test('admin can view user management page', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true, 'email_verified_at' => now()]);
    $this->actingAs($admin);

    $response = $this->get('/admin/dashboard/users');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/users/index')
        ->has('users')
        ->has('stats')
    );
});

test('admin can update user', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true, 'email_verified_at' => now()]);
    $user = User::factory()->create(['is_admin' => false, 'is_active' => true, 'email_verified_at' => now()]);
    $this->actingAs($admin);

    $response = $this->put("/admin/dashboard/users/{$user->id}", [
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
        'is_admin' => false,
        'is_active' => true,
    ]);

    $response->assertRedirect();
    expect($user->fresh()->name)->toBe('Updated Name');
    expect($user->fresh()->email)->toBe('updated@example.com');
});

test('admin can toggle user status', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true, 'email_verified_at' => now()]);
    $user = User::factory()->create(['is_admin' => false, 'is_active' => true, 'email_verified_at' => now()]);
    $this->actingAs($admin);

    $this->patch("/admin/dashboard/users/{$user->id}/toggle")->assertRedirect();
    expect($user->fresh()->is_active)->toBeFalse();

    $this->patch("/admin/dashboard/users/{$user->id}/toggle")->assertRedirect();
    expect($user->fresh()->is_active)->toBeTrue();
});

test('user management filters work', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true, 'email_verified_at' => now()]);
    User::factory()->create(['name' => 'Searchable User', 'email' => 'searchable@test.com', 'is_admin' => false, 'is_active' => true]);
    User::factory()->create(['is_admin' => false, 'is_active' => false]);
    $this->actingAs($admin);

    $response = $this->get('/admin/dashboard/users?search=Searchable');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->where('users.total', 1));

    $response = $this->get('/admin/dashboard/users?status=inactive');
    $response->assertOk();
});

test('admin and approved vendor accounts have verified verification status', function () {
    $admin = User::factory()->create([
        'name' => 'Super Admin',
        'email' => 'admin@test.com',
        'is_admin' => true,
        'is_active' => true,
        'email_verified_at' => now(),
    ]);

    $vendorUser = User::factory()->create([
        'name' => 'Mang Juan',
        'email' => 'juan@test.com',
        'is_admin' => false,
        'is_active' => true,
    ]);
    Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Mang Juan Store',
        'stall_location' => 'Stall 1',
        'product_categories' => ['Meat'],
        'status' => 'approved',
        'approved_at' => now(),
    ]);

    $customerUser = User::factory()->create([
        'name' => 'Regular Customer',
        'email' => 'customer@test.com',
        'is_admin' => false,
        'is_active' => true,
    ]);

    $this->actingAs($admin);

    $response = $this->get('/admin/dashboard/users');
    $response->assertOk();
    $response->assertInertia(function ($page) use ($admin, $vendorUser, $customerUser) {
        $users = collect($page->toArray()['props']['users']['data']);

        $adminData = $users->firstWhere('id', $admin->id);
        expect($adminData)->not->toBeNull();
        expect($adminData['role'])->toBe('admin');
        expect($adminData['verification']['status'])->toBe('verified');
        expect($adminData['verification']['id_type'])->toBe('Admin Account');

        $vendorData = $users->firstWhere('id', $vendorUser->id);
        expect($vendorData)->not->toBeNull();
        expect($vendorData['role'])->toBe('vendor');
        expect($vendorData['verification']['status'])->toBe('verified');

        $customerData = $users->firstWhere('id', $customerUser->id);
        expect($customerData)->not->toBeNull();
        expect($customerData['role'])->toBe('customer');
        expect($customerData['verification']['status'])->toBe('unverified');

        $verificationStats = $page->toArray()['props']['verificationStats'];
        // Both admin and approved vendor should be included in verified count
        expect($verificationStats['verified'])->toBeGreaterThanOrEqual(2);
    });
});

test('user management role filter works for vendor role', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true]);
    $vendorUser = User::factory()->create(['is_admin' => false, 'is_active' => true]);
    Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Test Vendor Stall',
        'stall_location' => 'Stall 2',
        'product_categories' => ['Fish'],
        'status' => 'approved',
    ]);
    User::factory()->create(['is_admin' => false, 'is_active' => true]);

    $this->actingAs($admin);

    $response = $this->get('/admin/dashboard/users?role=vendor');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('users.total', 1)
        ->where('users.data.0.id', $vendorUser->id)
        ->where('users.data.0.role', 'vendor')
    );
});

test('user management verification status filter works for verified accounts including admin and approved vendor', function () {
    $admin = User::factory()->create(['is_admin' => true, 'is_active' => true]);
    $vendorUser = User::factory()->create(['is_admin' => false, 'is_active' => true]);
    Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Verified Vendor Stall',
        'stall_location' => 'Stall 3',
        'product_categories' => ['Vegetables'],
        'status' => 'approved',
    ]);
    $customer = User::factory()->create(['is_admin' => false, 'is_active' => true]);

    $this->actingAs($admin);

    $response = $this->get('/admin/dashboard/users?verification_status=verified');
    $response->assertOk();
    $response->assertInertia(function ($page) use ($admin, $vendorUser, $customer) {
        $ids = collect($page->toArray()['props']['users']['data'])->pluck('id');
        expect($ids)->toContain($admin->id);
        expect($ids)->toContain($vendorUser->id);
        expect($ids)->not->toContain($customer->id);
    });

    $unverifiedResponse = $this->get('/admin/dashboard/users?verification_status=unverified');
    $unverifiedResponse->assertOk();
    $unverifiedResponse->assertInertia(function ($page) use ($admin, $vendorUser, $customer) {
        $ids = collect($page->toArray()['props']['users']['data'])->pluck('id');
        expect($ids)->not->toContain($admin->id);
        expect($ids)->not->toContain($vendorUser->id);
        expect($ids)->toContain($customer->id);
    });
});
