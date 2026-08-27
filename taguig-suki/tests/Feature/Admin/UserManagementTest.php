<?php

use App\Models\User;

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
